import { checkCompanyCompliant } from "../../helpers/CheckCompanyCompliant";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import OldMessage from "../../models/OldMessage";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { emitTicketContext } from "../SocketServices/TicketContextSocketService";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  ack?: number;
  queueId?: number;
  channel?: string;
}
interface Request {
  messageData: MessageData;
  companyId: number;
  skipWebsocket?: boolean;
}

export const websocketCreateMessage = async (
  message: Message
): Promise<void> => {
  const io = getIO();
  await emitTicketContext(
    io,
    message.ticketId,
    `company-${message.companyId}-appMessage`,
    {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    },
    [
      message.ticketId.toString(),
      `company-${message.companyId}-${message.ticket.status}`,
      `company-${message.companyId}-notification`,
      `queue-${message.ticket.queueId}-${message.ticket.status}`,
      `queue-${message.ticket.queueId}-notification`
    ]
  );
};

/**
 * SLA panel: keeps since when the client is waiting for a human reply. A
 * message sent by the company only counts as a reply when an attendant has
 * the ticket (status open); chatbot and queue messages do not stop the clock.
 */
const updateUnansweredSince = async (message: Message) => {
  const { ticket } = message;

  if (!message.fromMe && !ticket.unansweredSince) {
    await ticket.update({ unansweredSince: message.createdAt || new Date() });
  } else if (
    message.fromMe &&
    ticket.unansweredSince &&
    ticket.status === "open"
  ) {
    await ticket.update({ unansweredSince: null });
  }
};

const CreateMessageService = async ({
  messageData,
  companyId,
  skipWebsocket
}: Request): Promise<Message> => {
  const isNewMessage = !(await Message.findOne({
    where: { id: messageData.id, ticketId: messageData.ticketId },
    attributes: ["id"]
  }));

  await Message.upsert({ ...messageData, companyId });

  const message = await Message.findOne({
    where: {
      id: messageData.id,
      ticketId: messageData.ticketId
    },
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            as: "contact",
            include: ["tags", "extraInfo"]
          },
          "queue",
          "tags",
          "user",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name", "id"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"],
        where: {
          companyId
        },
        required: false
      },
      {
        model: OldMessage,
        as: "oldMessages",
        where: {
          ticketId: messageData.ticketId
        },
        required: false
      }
    ]
  });

  await message.ticket.contact.update({ presence: "available" });
  await message.ticket.contact.reload();

  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  if (isNewMessage) {
    await updateUnansweredSince(message);
  }

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (!(await checkCompanyCompliant(companyId))) {
    return message;
  }

  const io = getIO();

  if (!skipWebsocket) {
    await websocketCreateMessage(message);
  }

  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-contact`,
    {
      action: "update",
      contact: message.ticket.contact
    }
  );
  logger.debug(
    {
      company: companyId,
      ticket: message.ticketId,
      queue: message.ticket.queueId,
      status: message.ticket.status
    },
    "sending appMessage event"
  );
  return message;
};

export default CreateMessageService;
