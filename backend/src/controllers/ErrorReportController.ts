import path from "path";
import { promises as fs } from "fs";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { removeErrorReportFiles } from "../config/errorReportUpload";
import { safeAttachmentName } from "../helpers/AttachmentRules";
import {
  ERROR_REPORT_MAX_TOTAL_BYTES,
  errorReportFileType
} from "../helpers/ErrorReportRules";
import { ErrorReportAttachment } from "../models/ErrorReport";
import CreateErrorReportService from "../services/ErrorReportServices/CreateErrorReportService";
import DeliverErrorReportService from "../services/ErrorReportServices/DeliverErrorReportService";
import { logger } from "../utils/logger";

const firstBytes = async (filePath: string): Promise<Buffer> => {
  const handle = await fs.open(filePath, "r");
  try {
    const bytes = new Uint8Array(16);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return Buffer.from(bytes.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};

// Zap Komunick: the mail shows the name the user gave the file, ending in the
// extension of what the file really is.
const mailName = (originalName: string, extension: string): string => {
  const name = safeAttachmentName(originalName);
  const current = path.extname(name).toLowerCase();
  const same =
    current === extension || (extension === ".jpg" && current === ".jpeg");
  return same ? name : `${name}${extension}`;
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const files = (req.files as Express.Multer.File[]) || [];
  const storedNames = files.map(file => file.filename);

  try {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > ERROR_REPORT_MAX_TOTAL_BYTES)
      throw new AppError("ERR_ERROR_REPORT_FILES_TOO_LARGE", 413);

    const attachments: ErrorReportAttachment[] = await Promise.all(
      files.map(async file => {
        const type = errorReportFileType(await firstBytes(file.path));
        if (!type) throw new AppError("ERR_ERROR_REPORT_FILE_TYPE", 400);
        await fs.chmod(file.path, 0o600);
        return {
          storedName: file.filename,
          originalName: mailName(file.originalname, type.extension),
          mimeType: type.mimeType,
          size: file.size
        };
      })
    );

    const report = await CreateErrorReportService({
      userId: Number(req.user.id),
      companyId: req.user.companyId,
      title: req.body.title,
      location: req.body.location,
      description: req.body.description,
      screen: req.body.screen,
      appUrl: req.body.appUrl,
      userAgent: req.headers["user-agent"],
      attachments
    });

    // The answer does not wait for the mail server. A failure here stays in
    // the report and the periodic retry sends it later.
    DeliverErrorReportService(report.id).catch(error =>
      logger.error(
        { reportId: report.id, message: error?.message },
        "Error report mail failed"
      )
    );

    return res.status(201).json({ id: report.id });
  } catch (error) {
    await removeErrorReportFiles(storedNames).catch(cleanupError =>
      logger.warn(
        { message: cleanupError?.message },
        "Rejected error report: attachments not removed"
      )
    );
    throw error;
  }
};
