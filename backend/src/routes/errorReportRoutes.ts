import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import AppError from "../errors/AppError";
import { errorReportUpload } from "../config/errorReportUpload";
import { ERROR_REPORT_MAX_FILES } from "../helpers/ErrorReportRules";
import * as ErrorReportController from "../controllers/ErrorReportController";

// Zap Komunick: error report of the beta (docs/PRD.md, RF-030).
const errorReportRoutes = express.Router();

const UPLOAD_ERRORS: Record<string, [string, number]> = {
  LIMIT_FILE_SIZE: ["ERR_ERROR_REPORT_FILES_TOO_LARGE", 413],
  LIMIT_FILE_COUNT: ["ERR_ERROR_REPORT_TOO_MANY_FILES", 400],
  LIMIT_UNEXPECTED_FILE: ["ERR_ERROR_REPORT_TOO_MANY_FILES", 400]
};

const upload = (req: Request, res: Response, next: NextFunction): void => {
  errorReportUpload.array("files", ERROR_REPORT_MAX_FILES)(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const [code, status] = UPLOAD_ERRORS[error.code] || [
        "ERR_ERROR_REPORT_INVALID",
        400
      ];
      return next(new AppError(code, status));
    }
    return next(error);
  });
};

errorReportRoutes.post(
  "/error-reports",
  isAuth,
  upload,
  ErrorReportController.store
);

export default errorReportRoutes;
