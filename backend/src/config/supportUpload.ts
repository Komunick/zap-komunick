import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import multer from "multer";
import privateFiles from "./privateFiles";
import {
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_TOTAL_BYTES
} from "../helpers/SupportRules";

// Zap Komunick: attachments of the support tickets (RF-030). They live in the
// private volume under names the server chooses, and are only served by the
// authenticated route of the ticket they belong to.
export const supportDirectory = path.join(privateFiles.directory, "support");
// First version of the feature (error reports): files already stored there.
const legacyDirectory = path.join(privateFiles.directory, "error-reports");

const STORED_NAME = /^support-[0-9a-f-]{36}\.upload$/;
const LEGACY_NAME = /^report-[0-9a-f-]{36}\.upload$/;

export const supportFilePath = (storedName: unknown): string | null => {
  if (typeof storedName !== "string") return null;
  if (STORED_NAME.test(storedName))
    return path.join(supportDirectory, storedName);
  if (LEGACY_NAME.test(storedName))
    return path.join(legacyDirectory, storedName);
  return null;
};

export const supportUpload = multer({
  // Browsers send the file name as UTF-8; the default would read it as latin1.
  defParamCharset: "utf8",
  limits: {
    files: SUPPORT_MAX_FILES,
    fileSize: SUPPORT_MAX_TOTAL_BYTES,
    fields: 12,
    fieldSize: 64 * 1024
  },
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      fs.mkdir(supportDirectory, { recursive: true, mode: 0o700 }).then(
        () => callback(null, supportDirectory),
        error => callback(error, supportDirectory)
      );
    },
    filename(_req, _file, callback) {
      callback(null, `support-${randomUUID()}.upload`);
    }
  })
});

export const removeSupportFiles = async (
  storedNames: unknown[]
): Promise<void> => {
  await Promise.all(
    storedNames.map(async storedName => {
      const filePath = supportFilePath(storedName);
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    })
  );
};
