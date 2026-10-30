import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import multer from "multer";
import uploadConfig from "./upload";

// Zap Komunick: unique request-owned names make rollback cleanup safe. Other
// modules retain their existing storage and public delivery contracts.
export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: uploadConfig.directory,
    filename(_req, file, callback) {
      const originalExtension = path.extname(file.originalname);
      const extension = /^\.[a-zA-Z0-9]{1,32}$/.test(originalExtension)
        ? originalExtension
        : "";
      callback(null, `chat-${randomUUID()}${extension}`);
    }
  })
});

export async function removeChatUploadFiles(
  files: Express.Multer.File[] = []
): Promise<void> {
  const owned = files.filter(
    file =>
      /^chat-[0-9a-f-]{36}(?:\.[a-zA-Z0-9]{1,32})?$/.test(file.filename) &&
      path.resolve(file.path) ===
        path.resolve(uploadConfig.directory, file.filename)
  );
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
