import { promises as files } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import AppError from "../../errors/AppError";
import { getPublicPath } from "../../helpers/GetPublicPath";
import {
  queueMediaName,
  queueMediaPath
} from "../../helpers/QueueAdministrationRules";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";

export async function removeQueueMediaFile(
  raw: unknown,
  companyId: number
): Promise<void> {
  if (raw == null) return;
  const relative = queueMediaPath(raw, companyId);
  // Chat attachment identities are not sector media, even if a legacy row was
  // populated with a former public chat basename.
  if (/^chat-/i.test(relative)) throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  try {
    const root = path.resolve(getPublicPath());
    if ((await files.realpath(root)) !== root)
      throw new Error("unsafe storage");
    let target = root;
    const parts = relative.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      target = path.join(target, parts[index]);
      const stat = await files.lstat(target);
      if (
        stat.isSymbolicLink() ||
        (await files.realpath(target)) !== target ||
        (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())
      )
        throw new Error("unsafe storage");
    }
    await files.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }
}

export async function cleanupQueueUploads(
  uploads: Express.Multer.File[]
): Promise<void> {
  await Promise.all(
    (uploads || []).map(upload =>
      files.unlink(upload.path).catch(error => {
        if (error.code !== "ENOENT") throw error;
      })
    )
  );
}

async function writeQueueMedia(
  data: Buffer,
  companyId: number,
  name: string
): Promise<string> {
  const root = path.resolve(getPublicPath());
  if ((await files.realpath(root)) !== root)
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  let directory = root;
  const parts = ["media", String(companyId), `queue-${randomUUID()}`];
  for (let index = 0; index < parts.length; index += 1) {
    directory = path.join(directory, parts[index]);
    await files.mkdir(directory, { mode: 0o700 }).catch(error => {
      if (error.code !== "EEXIST" || index === parts.length - 1) throw error;
    });
    const stat = await files.lstat(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await files.realpath(directory)) !== directory
    )
      throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }
  const destination = path.join(directory, name);
  try {
    await files.writeFile(destination, Uint8Array.from(data), {
      flag: "wx",
      mode: 0o600
    });
  } catch (error) {
    // This UUID directory was created exclusively above. Remove partial bytes
    // on a failed write, while preserving a file that caused an EEXIST refusal.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST")
      await files.unlink(destination).catch(cleanup => {
        if (cleanup.code !== "ENOENT") throw cleanup;
      });
    await files.rmdir(directory).catch(cleanup => {
      if (!["ENOENT", "ENOTEMPTY"].includes(cleanup.code)) throw cleanup;
    });
    throw error;
  }
  return `${parts.join("/")}/${name}`;
}

export async function storeQueueMedia(
  target: Queue | QueueOption,
  companyId: number,
  uploads: Express.Multer.File[]
): Promise<void> {
  const file = uploads?.[0];
  try {
    if (!file || uploads.length !== 1)
      throw new AppError("ERR_BAD_REQUEST", 400);
    const name = queueMediaName(file.originalname);
    const saved = await writeQueueMedia(
      await files.readFile(file.path),
      companyId,
      name
    );
    try {
      await target.update({ mediaPath: saved, mediaName: name });
    } catch (error) {
      await removeQueueMediaFile(saved, companyId);
      throw error;
    }
  } finally {
    await cleanupQueueUploads(uploads);
  }
}

export async function deleteQueueMedia(
  target: Queue | QueueOption,
  companyId: number
): Promise<void> {
  await removeQueueMediaFile(target.mediaPath, companyId);
  await target.update({ mediaPath: null, mediaName: null });
}
