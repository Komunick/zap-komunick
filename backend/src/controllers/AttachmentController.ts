import { Request, Response } from "express";
import { pipeline } from "stream";
import { ReadStream } from "fs";
import AppError from "../errors/AppError";
import {
  attachmentDisposition,
  attachmentRange
} from "../helpers/AttachmentRules";
import {
  getTicketAttachment,
  listTicketAttachments,
  openTicketAttachment
} from "../services/AttachmentServices/TicketAttachmentService";
import { logger } from "../utils/logger";

const actor = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});
export const list = async (req: Request, res: Response): Promise<Response> => {
  const result = await listTicketAttachments(
    req.params.ticketId,
    actor(req),
    req.query
  );
  res.setHeader("Cache-Control", "private, no-store");
  return res.json(result);
};
export const show = async (req: Request, res: Response): Promise<Response> => {
  const result = await getTicketAttachment(
    req.params.ticketId,
    actor(req),
    req.params.sourceTicketId,
    req.params.messageId,
    req.query
  );
  res.setHeader("Cache-Control", "private, no-store");
  return res.json(result);
};
export const content = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = await openTicketAttachment(
    req.params.ticketId,
    actor(req),
    req.params.sourceTicketId,
    req.params.messageId,
    req.query
  );
  let range: ReturnType<typeof attachmentRange>;
  try {
    range = attachmentRange(req.headers.range, file.size);
  } catch (error) {
    await file.handle.close().catch(() => undefined);
    if (error instanceof AppError && error.statusCode === 416) {
      res.setHeader("Content-Range", `bytes */${file.size}`);
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(416).json({ error: "ERR_ATTACHMENT_RANGE" });
    }
    throw new AppError("ERR_ATTACHMENT_UNAVAILABLE", 503);
  }
  let stream: ReadStream;
  if (req.method !== "HEAD") {
    try {
      stream = file.handle.createReadStream({
        start: range.start,
        end: range.end,
        autoClose: true
      });
    } catch {
      await file.handle.close().catch(() => undefined);
      throw new AppError("ERR_ATTACHMENT_UNAVAILABLE", 503);
    }
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", attachmentDisposition(file.fileName));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", range.end - range.start + 1);
  if (range.partial)
    res.setHeader(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${file.size}`
    );
  res.status(range.partial ? 206 : 200);
  if (req.method === "HEAD") {
    await file.handle.close().catch(() => undefined);
    return res.end();
  }
  pipeline(stream, res, error => {
    if (error)
      logger.warn(
        { companyId: req.user.companyId, ticketId: req.params.ticketId },
        "Attachment stream unavailable"
      );
  });
  return res;
};
