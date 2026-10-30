import { Request, Response } from "express";
import {
  generateTicketIntegratedAssistant,
  reviewTicketIntegratedAssistant,
  ticketIntegratedAssistantClients,
  ticketIntegratedAssistantStatus
} from "../services/IntegratedAssistantServices/TicketIntegratedAssistantService";
import { auditRequest } from "../services/AuditServices/RecordAuditService";

const actor = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});
export const status = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketIntegratedAssistantStatus(
      req.params.ticketId,
      actor(req),
      req.query
    )
  );
export const clients = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ticketIntegratedAssistantClients(
      req.params.ticketId,
      actor(req),
      req.query
    )
  );
export const generate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await generateTicketIntegratedAssistant(
    req.params.ticketId,
    actor(req),
    req.body,
    req.query
  );
  // Auditing is best effort and must not add an awaited gap after final authorization.
  void auditRequest(
    req,
    "integrated_assistant.generated",
    "ticket",
    result.ticketId,
    {
      kind: result.kind,
      mode: result.mode,
      simulated: true,
      messageCount: result.context.messageCount,
      partial: result.context.partial,
      sourceCount: Object.values(result.sources).filter(
        source => source.state !== "notSelected"
      ).length,
      failedSourceCount: Object.values(result.sources).filter(
        source => source.state === "error"
      ).length
    }
  );
  return res.json(result);
};
export const review = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await reviewTicketIntegratedAssistant(
    req.params.ticketId,
    actor(req),
    req.body,
    req.query
  );
  void auditRequest(
    req,
    "integrated_assistant.reviewed",
    "ticket",
    req.params.ticketId,
    { kind: "reply", mode: "mock", simulated: true }
  );
  return res.json(result);
};
