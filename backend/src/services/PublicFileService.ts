import { Request, Response } from "express";
import path from "path";
import { promises as fs } from "fs";
import uploadConfig from "../config/upload";
import { publicFileRelativePath } from "../helpers/PublicFilePathRules";
import { isProtectedChatPublicPath } from "./ChatService/ChatMediaMigrationService";
import { logger } from "../utils/logger";

const unavailable = (res: Response) =>
  res.setHeader("Cache-Control", "no-store").status(404).end();

async function publicFile(relative: string): Promise<string | undefined> {
  const root = path.resolve(uploadConfig.directory);
  if ((await fs.lstat(root)).isSymbolicLink()) return undefined;
  let current = root;
  const parts = relative.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    if ((await fs.lstat(current)).isSymbolicLink()) return undefined;
  }
  if (!(await fs.stat(current)).isFile()) return undefined;
  const [realRoot, realFile] = await Promise.all([
    fs.realpath(root),
    fs.realpath(current)
  ]);
  const inside = path.relative(realRoot, realFile);
  if (!inside || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside))
    return undefined;
  return realFile;
}

// Zap Komunick: keep public media for other modules, but make every ingress
// consult the same chat denial rule before opening a file or handling Range.
export default async function servePublicFile(
  req: Request,
  res: Response
): Promise<void> {
  const relative = publicFileRelativePath(req.params[0]);
  if (!relative || (await isProtectedChatPublicPath(relative))) {
    unavailable(res);
    return;
  }
  let file: string | undefined;
  try {
    file = await publicFile(relative);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!["ENOENT", "ENOTDIR", "EISDIR", "ENAMETOOLONG"].includes(code))
      throw error;
  }
  if (!file) {
    unavailable(res);
    return;
  }
  if (file.endsWith(".aac")) res.setHeader("Content-Type", "audio/aac");
  const done = (error: Error & { code?: string }) => {
    if (!error || res.headersSent || res.destroyed) return;
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) {
      unavailable(res);
      return;
    }
    logger.debug({ code: error.code }, "Public file response failed");
    res.status(500).end();
  };
  if (req.query.inline === "1") {
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(file, done);
  } else res.download(file, done);
}
