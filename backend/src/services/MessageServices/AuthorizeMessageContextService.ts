import AppError from "../../errors/AppError";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

// Zap Komunick: an ID in a URL or quoted payload never bypasses context access.
const AuthorizeMessageContextService = async (
  messageId: string,
  actor: ContextActor,
  contextTicketId?: string | number
): Promise<Message> => {
  const message = await Message.findOne({
    where: { id: messageId, companyId: actor.companyId },
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
      attributes: ["id"]
    });
    if (!sourceTicket) throw new AppError("ERR_MESSAGE_NOT_FOUND", 404);
    if (
      !viewer.isAdmin &&
      message.queueId !== null &&
      !viewer.queueIds.includes(message.queueId) &&
      (await GetCompanySetting(
        actor.companyId,
        "messageVisibility",
        "message"
      )) === "message"
    ) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }
  return message;
};

export default AuthorizeMessageContextService;
