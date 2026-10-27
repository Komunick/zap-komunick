import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { auditRequest } from "../services/AuditServices/RecordAuditService";
import {
  createAcessoriasLink,
  deleteAcessoriasLink,
  ticketAcessoriasCatalog,
  ticketAcessoriasClients,
  ticketAcessoriasDetail,
  ticketAcessoriasStatus
} from "../services/AcessoriasServices/TicketAcessoriasService";

const actor = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});
const changed = (req: Request, contactId: number): void => {
  try {
    getIO()
      .to(`company-${req.user.companyId}-mainchannel`)
      .emit(`company-${req.user.companyId}-acessorias-links`, { contactId });
  } catch {
    logger.warn(
      { companyId: req.user.companyId, contactId },
      "Acessórias local link notification unavailable"
    );
  }
};
export const status = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketAcessoriasStatus(req.params.ticketId, actor(req), req.query)
  );
export const catalog = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketAcessoriasCatalog(req.params.ticketId, actor(req), req.query)
  );
export const clients = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketAcessoriasClients(req.params.ticketId, actor(req), req.query)
  );
export const detail = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketAcessoriasDetail(
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
  const { contactId, ...result } = await createAcessoriasLink(
    req.params.ticketId,
    actor(req),
    req.body,
    req.query
  );
  if (result.created) {
    await auditRequest(req, "acessorias.link_created", "contact", contactId, {
      provider: "acessorias",
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
  const { contactId, ...result } = await deleteAcessoriasLink(
    req.params.ticketId,
    actor(req),
    req.params.externalClientId,
    req.query
  );
  if (result.deleted) {
    await auditRequest(req, "acessorias.link_deleted", "contact", contactId, {
      provider: "acessorias",
      externalClientId: result.externalClientId
    });
    changed(req, contactId);
  }
  return res.json(result);
};
