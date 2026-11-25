import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import AppError from "../errors/AppError";
import { supportUpload } from "../config/supportUpload";
import { SUPPORT_MAX_FILES } from "../helpers/SupportRules";
import * as SupportController from "../controllers/SupportController";

// Zap Komunick: support tickets (docs/PRD.md, RF-030). Every route answers
// for the logged-in user; the service decides what each one may see.
const supportRoutes = express.Router();

const UPLOAD_ERRORS: Record<string, [string, number]> = {
  LIMIT_FILE_SIZE: ["ERR_SUPPORT_FILES_TOO_LARGE", 413],
  LIMIT_FILE_COUNT: ["ERR_SUPPORT_TOO_MANY_FILES", 400],
  LIMIT_UNEXPECTED_FILE: ["ERR_SUPPORT_TOO_MANY_FILES", 400]
};

const upload = (req: Request, res: Response, next: NextFunction): void => {
  supportUpload.array("files", SUPPORT_MAX_FILES)(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const [code, status] = UPLOAD_ERRORS[error.code] || [
        "ERR_SUPPORT_INVALID",
        400
      ];
      return next(new AppError(code, status));
    }
    return next(error);
  });
};

// Read with the alert key, not with a session (helpers/SupportAlert.ts).
supportRoutes.get("/support/alerts", SupportController.alerts);
supportRoutes.post(
  "/support/alert-token",
  isAuth,
  SupportController.rotateAlertToken
);
supportRoutes.delete(
  "/support/alert-token",
  isAuth,
  SupportController.revokeAlertToken
);
supportRoutes.get("/support/summary", isAuth, SupportController.summary);
supportRoutes.get("/support/tickets", isAuth, SupportController.index);
supportRoutes.post("/support/tickets", isAuth, upload, SupportController.store);
supportRoutes.get("/support/tickets/:ticketId", isAuth, SupportController.show);
supportRoutes.post(
  "/support/tickets/:ticketId/messages",
  isAuth,
  upload,
  SupportController.storeMessage
);
supportRoutes.post(
  "/support/tickets/:ticketId/actions",
  isAuth,
  SupportController.action
);
supportRoutes.post(
  "/support/tickets/:ticketId/read",
  isAuth,
  SupportController.read
);
supportRoutes.get(
  "/support/tickets/:ticketId/attachments/:attachmentId",
  isAuth,
  SupportController.attachment
);

export default supportRoutes;
