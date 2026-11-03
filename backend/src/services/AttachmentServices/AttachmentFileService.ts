import path from "path";
import fs, { promises as files } from "fs";
import { FileHandle } from "fs/promises";
import AppError from "../../errors/AppError";
import { getPublicPath } from "../../helpers/GetPublicPath";
import {
  detectedAttachmentMime,
  localAttachmentPath
} from "../../helpers/AttachmentRules";
import { isProtectedChatPublicPath } from "../ChatService/ChatMediaMigrationService";

const contained = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    !!relative &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
};
// Reads only the bounded signature. Keeping the opened descriptor for content also
// prevents a later rename from switching the bytes after authorization.
export const openAttachmentFile = async (
  raw: string,
  companyId: number
): Promise<{ handle: FileHandle; size: number; mimeType: string | null }> => {
  let handle: FileHandle;
  try {
    localAttachmentPath(raw, companyId);
    // Zap Komunick: another authorized module cannot reopen a known private
    // chat file if its former public pathname is reintroduced.
    if (await isProtectedChatPublicPath(raw)) throw new Error("private chat");
    const root = await files.realpath(getPublicPath());
    const target = path.resolve(root, raw);
    if (!contained(root, target)) throw new Error("outside");
    const real = await files.realpath(target);
    if (!contained(root, real)) throw new Error("outside");
    const canonical = path.relative(root, real).split(path.sep).join("/");
    localAttachmentPath(canonical, companyId);
    if (await isProtectedChatPublicPath(canonical))
      throw new Error("private chat");
    const before = await files.stat(real);
    if (!before.isFile()) throw new Error("not regular");
    handle = await files.open(
      real,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
    );
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      stat.ino !== before.ino ||
      stat.dev !== before.dev ||
      stat.size !== before.size ||
      (await files.realpath(target)) !== real
    )
      throw new Error("changed");
    const bytes = new Uint8Array(512);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return {
      handle,
      size: stat.size,
      mimeType: detectedAttachmentMime(bytes.subarray(0, bytesRead), raw)
    };
  } catch {
    if (handle) await handle.close().catch(() => undefined);
    // FS errors contain absolute paths; never send/log the original object.
    throw new AppError("ERR_ATTACHMENT_NOT_FOUND", 404);
  }
};
