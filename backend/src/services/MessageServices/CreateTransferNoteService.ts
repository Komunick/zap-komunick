import { Op } from "sequelize";
import { randomBytes } from "crypto";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  noteBody,
  ParsedNote,
  quoteMessages,
  TRANSFER_NOTE_TYPE
} from "../../helpers/TransferNote";
import { websocketCreateMessage } from "./CreateMessageService";

// Zap Komunick: internal note that goes with a transfer (docs/PRD.md, RF-017).
// It is a Message row that only lives in the system: it never goes through
// SendWhatsAppMessage, it does not touch the SLA clock and it is not the
// "last message" of the ticket.

interface Request {
  ticket: Ticket;
  parsed: ParsedNote;
  userId: number;
  fromQueueId: number | null;
  fromUserId: number | null;
}

const CreateTransferNoteService = async ({
  ticket,
  parsed,
  userId,
  fromQueueId,
  fromUserId
}: Request): Promise<Message> => {
  // only messages of this client, in this company
  const contactTickets = await Ticket.findAll({
    where: { contactId: ticket.contactId, companyId: ticket.companyId },
    attributes: ["id"]
  });
  const sources = parsed.messageIds.length
    ? await Message.findAll({
        where: {
          id: { [Op.in]: parsed.messageIds },
          ticketId: { [Op.in]: contactTickets.map(t => t.id) },
          companyId: ticket.companyId,
          mediaType: { [Op.ne]: TRANSFER_NOTE_TYPE }
        },
        include: [{ model: Contact, as: "contact", attributes: ["name"] }]
      })
    : [];

  const quotes = quoteMessages(
    sources.map(m => ({
      id: m.id,
      fromMe: m.fromMe,
      body: m.body,
      mediaType: m.mediaType,
      createdAt: m.createdAt,
      senderName: m.fromMe ? null : m.contact?.name
    }))
  );

  const [author, fromQueue, toQueue, fromUser, toUser] = await Promise.all([
    User.findByPk(userId, { attributes: ["id", "name"] }),
    fromQueueId
      ? Queue.findByPk(fromQueueId, { attributes: ["id", "name"] })
      : null,
    ticket.queueId
      ? Queue.findByPk(ticket.queueId, { attributes: ["id", "name"] })
      : null,
    fromUserId
      ? User.findByPk(fromUserId, { attributes: ["id", "name"] })
      : null,
    ticket.userId
      ? User.findByPk(ticket.userId, { attributes: ["id", "name"] })
      : null
  ]);

  const id = `ZKNOTE${randomBytes(12).toString("hex").toUpperCase()}`;
  await Message.create({
    id,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    companyId: ticket.companyId,
    queueId: ticket.queueId,
    fromMe: true,
    read: true,
    ack: 0,
    channel: ticket.channel || "whatsapp",
    mediaType: TRANSFER_NOTE_TYPE,
    body: noteBody(parsed.note, quotes),
    dataJson: JSON.stringify({
      transferNote: {
        note: parsed.note,
        quotes,
        author: author ? { id: author.id, name: author.name } : null,
        from: {
          queue: fromQueue ? { id: fromQueue.id, name: fromQueue.name } : null,
          user: fromUser ? { id: fromUser.id, name: fromUser.name } : null
        },
        to: {
          queue: toQueue ? { id: toQueue.id, name: toQueue.name } : null,
          user: toUser ? { id: toUser.id, name: toUser.name } : null
        }
      }
    })
  } as never);

  const message = await Message.findByPk(id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          { model: Contact, as: "contact", include: ["tags", "extraInfo"] },
          "queue",
          "tags",
          "user",
          { model: Whatsapp, as: "whatsapp", attributes: ["name", "id"] }
        ]
      }
    ]
  });

  websocketCreateMessage(message);
  return message;
};

export default CreateTransferNoteService;
