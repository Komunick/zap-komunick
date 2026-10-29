import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { auditRequest } from "../services/AuditServices/RecordAuditService";
import {
  createSciLink,
  deleteSciLink,
  ticketSciCatalog,
  ticketSciClients,
  ticketSciDetail,
  ticketSciStatus
} from "../services/SciServices/TicketSciService";

const actor = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});
const changed = (req: Request, contactId: number): void => {
  try {
    getIO()
      .to(`company-${req.user.companyId}-mainchannel`)
      .emit(`company-${req.user.companyId}-sci-links`, { contactId });
  } catch {
    logger.warn(
      { companyId: req.user.companyId, contactId },
      "SCI local link notification unavailable"
    );
  }
};
export const status = async (req: Request, res: Response): Promise<Response> =>
  res.json(await ticketSciStatus(req.params.ticketId, actor(req), req.query));
export const catalog = async (req: Request, res: Response): Promise<Response> =>
  res.json(await ticketSciCatalog(req.params.ticketId, actor(req), req.query));
export const clients = async (req: Request, res: Response): Promise<Response> =>
  res.json(await ticketSciClients(req.params.ticketId, actor(req), req.query));
export const detail = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketSciDetail(
      req.params.ticketId,
      actor(req),
      req.params.externalClientId,
      req.query
    )
  );
export const create = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId, ...result } = await createSciLink(
    req.params.ticketId,
    actor(req),
    req.body,
    req.query
  );
  if (result.created) {
    await auditRequest(req, "sci.link_created", "contact", contactId, {
      provider: "sci",
      externalClientId: result.externalClientId
    });
    changed(req, contactId);
  }
  return res.json(result);
};
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId, ...result } = await deleteSciLink(
    req.params.ticketId,
    actor(req),
    req.params.externalClientId,
    req.query
  );
  if (result.deleted) {
    await auditRequest(req, "sci.link_deleted", "contact", contactId, {
      provider: "sci",
      externalClientId: result.externalClientId
    });
    changed(req, contactId);
  }
  return res.json(result);
};
