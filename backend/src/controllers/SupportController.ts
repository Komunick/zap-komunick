import path from "path";
import { promises as fs } from "fs";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { removeSupportFiles } from "../config/supportUpload";
import { safeAttachmentName } from "../helpers/AttachmentRules";
import {
  SUPPORT_MAX_TOTAL_BYTES,
  supportFileType,
  supportTicketId
} from "../helpers/SupportRules";
import { SupportViewer } from "../helpers/SupportView";
import { SupportAttachment } from "../models/SupportMessage";
import {
  createSupportMessage,
  createSupportTicket,
  listSupportTickets,
  markSupportTicketRead,
  runSupportAction,
  showSupportTicket,
  supportAttachmentFile,
  supportSummary
} from "../services/SupportServices/SupportTicketService";
import { logger } from "../utils/logger";

// Zap Komunick: support tickets (docs/PRD.md, RF-030).
const viewerOf = (req: Request): SupportViewer => ({
  userId: Number(req.user.id),
  companyId: req.user.companyId,
  isSuper: req.user.isSuper === true
});

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

// The name the user gave the file, ending in the extension of what the file
// really is.
const displayName = (originalName: string, extension: string): string => {
  const name = safeAttachmentName(originalName);
  const current = path.extname(name).toLowerCase();
  const same =
    current === extension || (extension === ".jpg" && current === ".jpeg");
  return same ? name : `${name}${extension}`;
};

/**
 * Checks the uploaded files and runs the action that stores them. Whatever
 * goes wrong, no file of a refused request stays on disk.
 */
const withAttachments = async <T>(
  req: Request,
  action: (attachments: SupportAttachment[]) => Promise<T>
): Promise<T> => {
  const files = (req.files as Express.Multer.File[]) || [];
  try {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > SUPPORT_MAX_TOTAL_BYTES)
      throw new AppError("ERR_SUPPORT_FILES_TOO_LARGE", 413);
    const attachments = await Promise.all(
      files.map(async file => {
        const type = supportFileType(await firstBytes(file.path));
        if (!type) throw new AppError("ERR_SUPPORT_FILE_TYPE", 400);
        await fs.chmod(file.path, 0o600);
        return {
          storedName: file.filename,
          originalName: displayName(file.originalname, type.extension),
          mimeType: type.mimeType,
          size: file.size
        };
      })
    );
    return await action(attachments);
  } catch (error) {
    await removeSupportFiles(files.map(file => file.filename)).catch(
      cleanupError =>
        logger.warn(
          { message: cleanupError?.message },
          "Refused support upload: attachments not removed"
        )
    );
    throw error;
  }
};

export const index = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await listSupportTickets(viewerOf(req), {
      scope: req.query.scope,
      search: req.query.search
    })
  );

export const summary = async (req: Request, res: Response): Promise<Response> =>
  res.json(await supportSummary(viewerOf(req)));

export const store = async (req: Request, res: Response): Promise<Response> => {
  const ticket = await withAttachments(req, attachments =>
    createSupportTicket(viewerOf(req), {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      priority: req.body.priority,
      location: req.body.location,
      screen: req.body.screen,
      appUrl: req.body.appUrl,
      userAgent: req.headers["user-agent"],
      attachments
    })
  );
  return res.status(201).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await showSupportTicket(viewerOf(req), supportTicketId(req.params.ticketId))
  );

export const storeMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ticketId = supportTicketId(req.params.ticketId);
  const detail = await withAttachments(req, attachments =>
    createSupportMessage(viewerOf(req), ticketId, {
      body: req.body.body,
      attachments
    })
  );
  return res.status(201).json(detail);
};

export const action = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await runSupportAction(
      viewerOf(req),
      supportTicketId(req.params.ticketId),
      { action: req.body?.action, text: req.body?.text }
    )
  );

export const read = async (req: Request, res: Response): Promise<Response> => {
  await markSupportTicketRead(
    viewerOf(req),
    supportTicketId(req.params.ticketId)
  );
  return res.status(204).send();
};

export const attachment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { filePath, attachment: file } = await supportAttachmentFile(
    viewerOf(req),
    supportTicketId(req.params.ticketId),
    req.params.attachmentId
  );
  try {
    await fs.access(filePath);
  } catch {
    throw new AppError("ERR_SUPPORT_TICKET_NOT_FOUND", 404);
  }
  // Only images, videos and PDF are ever stored, with the type read from the
  // content; the browser must not guess anything else.
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );
  await new Promise<void>((resolve, reject) => {
    res.sendFile(filePath, { dotfiles: "deny" }, error =>
      error ? reject(error) : resolve()
    );
  });
};
