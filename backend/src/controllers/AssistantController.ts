import { Request, Response } from "express";
import {
  generateTicketAssistant,
  ticketAssistantStatus
} from "../services/AssistantServices/TicketAssistantService";
import { auditRequest } from "../services/AuditServices/RecordAuditService";

const actor = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});
export const status = async (req: Request, res: Response): Promise<Response> =>
  res.json(await ticketAssistantStatus(req.params.ticketId, actor(req)));

export const generate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await generateTicketAssistant(
    req.params.ticketId,
    actor(req),
    req.body
  );
  await auditRequest(req, "assistant.generated", "ticket", result.ticketId, {
    kind: result.kind,
    mode: result.mode,
    simulated: true,
    messageCount: result.context.messageCount,
    characterCount: result.context.characterCount,
    partial: result.context.partial
  });
  return res.json(result);
};
