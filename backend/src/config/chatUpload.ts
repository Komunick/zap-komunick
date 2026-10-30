import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import multer from "multer";
import {
  chatMediaDirectory,
  ensureChatMediaDirectory,
  inspectChatMediaDirectory
} from "./chatMedia";
import { isChatUploadName } from "../helpers/ChatMediaRules";

// Zap Komunick: unique request-owned names make rollback cleanup safe. Other
// modules retain their existing storage and public delivery contracts.
export const chatUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      ensureChatMediaDirectory().then(
        () => callback(null, chatMediaDirectory),
        error => callback(error, chatMediaDirectory)
      );
    },
    filename(_req, file, callback) {
      const originalExtension = path.extname(file.originalname);
      const extension = /^\.[a-zA-Z0-9]{1,32}$/.test(originalExtension)
        ? originalExtension
        : "";
      callback(null, `chat-${randomUUID()}${extension}`);
    }
  })
});

export async function finalizeChatUploadFiles(
  files: Express.Multer.File[] = []
): Promise<void> {
  if (files.length && !(await inspectChatMediaDirectory()))
    throw new Error("ERR_CHAT_MEDIA_STORAGE_UNSAFE");
  const results = await Promise.allSettled(
    files.map(async file => {
      if (
        !isChatUploadName(file.filename) ||
        path.resolve(file.path) !==
          path.resolve(chatMediaDirectory, file.filename)
      )
        throw new Error("ERR_CHAT_MEDIA_STORAGE_UNSAFE");
      const stat = await fs.lstat(file.path);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("ERR_CHAT_MEDIA_STORAGE_UNSAFE");
      await fs.chmod(file.path, 0o600);
    })
  );
  const failed = results.find(result => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}

export async function removeChatUploadFiles(
  files: Express.Multer.File[] = []
): Promise<void> {
  const owned = files.filter(
    file =>
      isChatUploadName(file.filename) &&
      path.resolve(file.path) ===
        path.resolve(chatMediaDirectory, file.filename)
  );
  if (owned.length && !(await inspectChatMediaDirectory()))
    throw new Error("ERR_CHAT_MEDIA_STORAGE_UNSAFE");
  const results = await Promise.allSettled(
    owned.map(async file => {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    })
  );
  const failed = results.find(result => result.status === "rejected");
  if (failed && failed.status === "rejected") throw failed.reason;
}
