import AppError from "../../errors/AppError";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import {
  sectorReachedMessage,
  seesHistoryMessage
} from "../../helpers/HistoryVisibility";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

// Zap Komunick: an ID in a URL or quoted payload never bypasses context access.
const AuthorizeMessageContextService = async (
  messageId: string,
  actor: ContextActor,
  contextTicketId?: string | number,
  sourceTicketId?: number
): Promise<Message> => {
  const message = await Message.findOne({
    where: {
      id: messageId,
      companyId: actor.companyId,
      ...(sourceTicketId === undefined ? {} : { ticketId: sourceTicketId })
    },
    attributes: ["id", "ticketId", "queueId"]
  });
  if (!message) throw new AppError("ERR_MESSAGE_NOT_FOUND", 404);
  const { ticket, viewer } = await AuthorizeTicketContextService(
    contextTicketId === undefined ? message.ticketId : contextTicketId,
    actor
  );
  if (message.ticketId !== ticket.id) {
    const sourceTicket = await Ticket.findOne({
      where: {
        id: message.ticketId,
        companyId: actor.companyId,
        contactId: ticket.contactId
      },
      attributes: ["id", "queueId"]
    });
    if (!sourceTicket) throw new AppError("ERR_MESSAGE_NOT_FOUND", 404);
    // Same rule as the history of the conversation (helpers/
    // HistoryVisibility): the ticket of the message is in a sector of the
    // attendant now, the message was exchanged in one, or it was already in
    // the conversation when their sector last exchanged a message there.
    if (
      !viewer.isAdmin &&
      !seesHistoryMessage(
        viewer.queueIds,
        message.queueId,
        sourceTicket.queueId
      ) &&
      (await GetCompanySetting(
        actor.companyId,
        "messageVisibility",
        "message"
      )) === "message" &&
      !(await sectorReachedMessage(message, actor.companyId, viewer.queueIds))
    ) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }
  return message;
};

export default AuthorizeMessageContextService;
