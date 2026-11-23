import { FindOptions, Op, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import AuthorizeTicketContextService from "../TicketServices/AuthorizeTicketContextService";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  HistoryTicketSummary,
  summarizeHistoryTicket
} from "../../helpers/HistoryTickets";

interface Request {
  ticketId: string;
  companyId: number;
  nextId?: string;
  userId: string | number;
  minUpdatedAt?: string;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number | null;
  hasMore: boolean;
  nextId: string | null;
  // Zap Komunick: context of the client history (RF-017, RF-027)
  hiddenHistory: number;
  historyTickets: HistoryTicketSummary[];
}

const ListMessagesService = async ({
  nextId,
  ticketId,
  companyId,
  userId,
  minUpdatedAt
}: Request): Promise<Response> => {
  const { viewer } = await AuthorizeTicketContextService(ticketId, {
    userId,
    companyId
  });
  const queues = viewer.queueIds;
  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const limit = 100;
  const restrictHistory =
    !viewer.isAdmin &&
    (await GetCompanySetting(companyId, "messageVisibility", "message")) ===
      "message";

  // Zap Komunick: the whole history of the client, not only this ticket
  // (docs/PRD.md, RF-017). A client who writes again after a resolved
  // conversation gets a new ticket; its old messages stay visible here.
  const contactTickets = await Ticket.findAll({
    where: {
      contactId: ticket.contactId,
      companyId,
      ...(restrictHistory && { queueId: { [Op.in]: queues } })
    },
    attributes: ["id"]
  });
  const ticketIds = Array.from(
    new Set([ticket.id, ...contactTickets.map(t => t.id)])
  );

  // Client, office and sector fence shared by the page, its cursor and the
  // quoted/reply associations.
  const fence: WhereOptions[] = [
    { ticketId: { [Op.in]: ticketIds } },
    { companyId }
  ];

  if (restrictHistory) {
    // Other tickets must still belong to an allowed queue. Their messages
    // also retain their original queue restrictions.
    fence.push({
      [Op.or]: [
        { ticketId: ticket.id },
        {
          queueId: {
            [Op.or]: {
              [Op.in]: queues,
              [Op.eq]: null
            }
          }
        }
      ]
    });
  }

  // Reactions are not rows of the conversation: they come back as `replies`
  // of the message they react to.
  const conditions: WhereOptions[] = [
    ...fence,
    {
      mediaType: {
        [Op.or]: {
          [Op.ne]: "reactionMessage",
          [Op.is]: null
        }
      }
    }
  ];

  const options: FindOptions = {
    where: { [Op.and]: conditions }
  };
  // Keep this copy free of pagination predicates for the cursor lookup.
  const contextConditions = [...conditions];

  if (minUpdatedAt) {
    const parsedMinUpdatedAt = new Date(minUpdatedAt);

    if (Number.isNaN(parsedMinUpdatedAt.getTime())) {
      throw new AppError("ERR_INVALID_MIN_UPDATED_AT", 400);
    }

    conditions.push({ updatedAt: { [Op.gte]: parsedMinUpdatedAt } });
  } else if (nextId) {
    const cursorMessage = await Message.findOne({
      where: {
        [Op.and]: [...contextConditions, { id: nextId }]
      },
      attributes: ["id", "createdAt"]
    });

    if (!cursorMessage) {
      throw new AppError("ERR_MESSAGE_NOT_FOUND", 404);
    }

    conditions.push({ createdAt: { [Op.lt]: cursorMessage.createdAt } });
  }

  const messages = await Message.findAll({
    ...options,
    limit: limit + 1,
    include: [
      { model: Contact, as: "contact", where: { companyId }, required: false },
      {
        model: Message,
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact",
            where: { companyId },
            required: false
          }
        ],
        where: { [Op.and]: fence },
        required: false
      },
      {
        model: Message,
        as: "replies",
        // Zap Komunick: the page excludes reactions; the replies must not, or
        // the client's reactions never reach the message they belong to.
        where: { [Op.and]: fence },
        include: [
          {
            model: Contact,
            as: "contact",
            where: { companyId },
            required: false
          }
        ],
        required: false
      },
      {
        model: Queue,
        as: "queue"
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  const hasMore = messages.length > limit;
  const visibleMessages = hasMore ? messages.slice(0, limit) : messages;
  const oldestMessage = visibleMessages[visibleMessages.length - 1];

  // Zap Komunick: when the sector rule hides part of the client history, say
  // how much, so the team knows it exists and who can open it (RF-027).
  let hiddenHistory = 0;
  if (restrictHistory && !nextId && !minUpdatedAt) {
    const allTickets = await Ticket.findAll({
      where: { contactId: ticket.contactId, companyId },
      attributes: ["id"]
    });
    const notReaction = {
      mediaType: {
        [Op.or]: {
          [Op.ne]: "reactionMessage",
          [Op.is]: null
        }
      }
    };
    const [total, visible] = await Promise.all([
      Message.count({
        where: {
          [Op.and]: [
            { ticketId: { [Op.in]: allTickets.map(t => t.id) } },
            { companyId },
            notReaction
          ]
        }
      }),
      Message.count({ where: { [Op.and]: contextConditions } })
    ]);
    hiddenHistory = Math.max(0, total - visible);
  }

  // Zap Komunick: when, where and through which channel each ticket of the
  // page happened, for the dividers of the history (RF-027).
  const pageTicketIds = Array.from(
    new Set(visibleMessages.map(message => message.ticketId))
  );
  const historyTickets = pageTicketIds.length
    ? (
        await Ticket.findAll({
          where: { id: { [Op.in]: pageTicketIds }, companyId },
          attributes: ["id", "status", "createdAt", "updatedAt"],
          include: [
            { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["id", "name", "status"]
            },
            { model: User, as: "user", attributes: ["id", "name"] }
          ]
        })
      ).map(summarizeHistoryTicket)
    : [];

  return {
    messages: visibleMessages.reverse(),
    ticket,
    count: null,
    hasMore,
    nextId: hasMore && oldestMessage ? oldestMessage.id : null,
    hiddenHistory,
    historyTickets
  };
};

export default ListMessagesService;
