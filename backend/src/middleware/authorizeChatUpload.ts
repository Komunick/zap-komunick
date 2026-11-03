import { NextFunction, Request, Response } from "express";
import AuthorizeChatService from "../services/ChatService/AuthorizeChatService";
import {
  chatUpload,
  finalizeChatUploadFiles,
  removeChatUploadFiles
} from "../config/chatUpload";

export default async function authorizeChatUpload(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  await AuthorizeChatService(req.params.id, {
    userId: req.user.id,
    companyId: req.user.companyId
  });
  next();
}

export function receiveChatUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  chatUpload.array("medias")(req, res, async error => {
    let failure = error;
    if (!failure) {
      try {
        await finalizeChatUploadFiles(req.files as Express.Multer.File[]);
      } catch (fileError) {
        failure = fileError;
      }
    }
    if (!failure) return next();
    try {
      await removeChatUploadFiles(req.files as Express.Multer.File[]);
      return next(failure);
    } catch (cleanupError) {
      return next(cleanupError);
    }
  });
}
