import AppError from "../../errors/AppError";
import {
  ConflictRequester,
  describeOpenTicket
} from "../../helpers/OpenTicketConflict";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  ContextActor,
  loadTicketViewer
} from "./AuthorizeTicketContextService";

// Zap Komunick: ERR_OTHER_OPEN_TICKET with who has the ticket, its queue and
// channel, so the screen can tell it and offer to open or take it (RF-026).
const OpenTicketConflictError = async (
  ticketId: number,
  actor?: ContextActor
): Promise<AppError> => {
  const ticket = await Ticket.findByPk(ticketId, {
    attributes: ["id", "uuid", "status", "userId", "queueId", "updatedAt"],
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "status"] }
    ]
  });

  if (!ticket) {
    return new AppError("ERR_OTHER_OPEN_TICKET");
  }

  let requester: ConflictRequester | undefined;
  if (actor?.userId && actor.companyId) {
    try {
      requester = {
        userId: Number(actor.userId),
        viewer: await loadTicketViewer(actor)
      };
    } catch {
      requester = undefined;
    }
  }

  return new AppError("ERR_OTHER_OPEN_TICKET", 400, "warn", {
    openTicket: describeOpenTicket(ticket, requester)
  });
};

export default OpenTicketConflictError;
