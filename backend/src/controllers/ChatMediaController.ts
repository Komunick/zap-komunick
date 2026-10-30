import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { chatMediaDelivery } from "../helpers/ChatMediaRules";
import FindChatMediaService from "../services/ChatService/FindChatMediaService";
import { logger } from "../utils/logger";

// Zap Komunick: no path or storage basename is accepted from the browser.
export async function show(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const media = await FindChatMediaService(
    req.params.chatId,
    req.params.messageId,
    {
      userId: req.user.id,
      companyId: req.user.companyId
    }
  );
  const delivery = chatMediaDelivery(
    media.mimeType || false,
    req.query.download === "1"
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (delivery.contentType === "application/octet-stream")
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  if (delivery.inline) res.setHeader("Content-Disposition", "inline");
  else res.attachment(media.mediaName);
  res.type(delivery.contentType);
  res.sendFile(
    media.filePath,
    { cacheControl: false, lastModified: false, dotfiles: "deny" },
    error => {
      if (!error) return;
      if (res.headersSent || req.aborted) {
        if (!req.aborted) logger.warn("Private chat media stream interrupted");
        res.destroy();
        return;
      }
      res.removeHeader("Content-Type");
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Disposition");
      const status = (error as { status?: number }).status;
      if (status === 416) {
        const headers = (
          error as unknown as { headers?: Record<string, string> }
        ).headers;
        if (headers?.["Content-Range"])
          res.setHeader("Content-Range", headers["Content-Range"]);
        res.status(416).end();
        return;
      }
      res.removeHeader("Content-Range");
      if (status === 404 || (error as NodeJS.ErrnoException).code === "ENOENT")
        next(new AppError("ERR_NO_CHAT_FOUND", 404));
      else {
        logger.warn("Private chat media delivery unavailable");
        next(new AppError("ERR_CHAT_MEDIA_UNAVAILABLE", 503));
      }
    }
  );
}
