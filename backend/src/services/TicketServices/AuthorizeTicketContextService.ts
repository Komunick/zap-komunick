import AppError from "../../errors/AppError";
import { Transaction } from "sequelize";
import {
  isWaitingInGeneralTriage,
  loadMemberGeneralTriageScope
} from "../../helpers/GeneralTriage";
import {
  ticketContextError,
  TicketContext,
  TicketViewer
} from "../../helpers/TicketAccessRules";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

export interface ContextActor {
  userId: string | number;
  companyId: number;
}

export const loadTicketViewer = async (
  { userId, companyId }: ContextActor,
  transaction?: Transaction
): Promise<TicketViewer> => {
  const user = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id", "companyId", "profile"],
    ...(transaction ? { transaction } : {}),
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "companyId"],
        where: { companyId },
        required: false
      }
    ]
  });
  if (!user || user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return {
    companyId,
    isAdmin: user.profile === "admin",
    queueIds: user.queues
      .filter(queue => queue.companyId === companyId)
      .map(queue => queue.id)
  };
};

const AuthorizeTicketContextService = async (
  ticketId: string | number,
  actor: ContextActor,
  expectedContactId?: string | number,
  transaction?: Transaction
): Promise<{ ticket: Ticket; viewer: TicketViewer }> => {
  if (!Number.isSafeInteger(Number(ticketId)) || Number(ticketId) <= 0) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }
  const viewer = await loadTicketViewer(actor, transaction);
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId: actor.companyId },
    attributes: ["id", "companyId", "contactId", "queueId", "isGroup"],
    ...(transaction ? { transaction } : {})
  });
  if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  const contact = await Contact.findOne({
    where: { id: ticket.contactId, companyId: actor.companyId },
    attributes: ["id", "companyId"],
    ...(transaction ? { transaction } : {})
  });
  if (!contact) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  // Zap Komunick (RF-033): a ticket waiting for the customer to pick a sector
  // counts as being in the general queue for whoever belongs to that queue.
  // The first read stays as it was; what the rule needs is only read for a
  // ticket without a queue, which a non-administrator was always refused.
  let context: TicketContext = ticket;
  if (!viewer.isAdmin && ticket.queueId === null && viewer.queueIds.length) {
    const state = await Ticket.findOne({
      where: { id: ticket.id, companyId: actor.companyId },
      attributes: [
        "id",
        "queueId",
        "isGroup",
        "status",
        "channel",
        "userId",
        "whatsappId",
        "generalTriageStartedAt"
      ],
      ...(transaction ? { transaction } : {})
    });
    if (state?.generalTriageStartedAt) {
      const scope = await loadMemberGeneralTriageScope(
        actor.companyId,
        viewer.queueIds,
        transaction
      );
      if (scope && isWaitingInGeneralTriage(state, scope)) {
        context = {
          companyId: ticket.companyId,
          contactId: ticket.contactId,
          queueId: scope.queueId
        };
      }
    }
  }
  const error = ticketContextError(
    context,
    viewer,
    contact.companyId,
    expectedContactId === undefined ? undefined : Number(expectedContactId)
  );
  if (error) {
    throw new AppError(error, error === "ERR_NO_PERMISSION" ? 403 : 404);
  }
  return { ticket, viewer };
};

export default AuthorizeTicketContextService;
