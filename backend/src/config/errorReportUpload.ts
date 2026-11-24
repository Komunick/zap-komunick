import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import multer from "multer";
import privateFiles from "./privateFiles";
import {
  ERROR_REPORT_MAX_FILES,
  ERROR_REPORT_MAX_TOTAL_BYTES
} from "../helpers/ErrorReportRules";

// Zap Komunick: attachments of the error reports (RF-030). They live in the
// private volume, under names the server chooses, only until the mail goes
// out. Nothing serves this folder over HTTP.
export const errorReportDirectory = path.join(
  privateFiles.directory,
  "error-reports"
);

const STORED_NAME = /^report-[0-9a-f-]{36}\.upload$/;

export const errorReportFilePath = (storedName: unknown): string | null =>
  typeof storedName === "string" && STORED_NAME.test(storedName)
    ? path.join(errorReportDirectory, storedName)
    : null;

export const errorReportUpload = multer({
  // Browsers send the file name as UTF-8; the default would read it as latin1.
  defParamCharset: "utf8",
  limits: {
    files: ERROR_REPORT_MAX_FILES,
    fileSize: ERROR_REPORT_MAX_TOTAL_BYTES,
    fields: 10,
    fieldSize: 64 * 1024
  },
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      fs.mkdir(errorReportDirectory, { recursive: true, mode: 0o700 }).then(
        () => callback(null, errorReportDirectory),
        error => callback(error, errorReportDirectory)
      );
    },
    filename(_req, _file, callback) {
      callback(null, `report-${randomUUID()}.upload`);
    }
  })
});

export const removeErrorReportFiles = async (
  storedNames: unknown[]
): Promise<void> => {
  await Promise.all(
    storedNames.map(async storedName => {
      const filePath = errorReportFilePath(storedName);
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    })
  );
};
