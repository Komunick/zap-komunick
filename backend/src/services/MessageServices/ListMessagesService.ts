import { FindOptions, Op, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import AuthorizeTicketContextService from "../TicketServices/AuthorizeTicketContextService";
import Contact from "../../models/Contact";

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

  // Zap Komunick: the whole history of the client, not only this ticket
  // (docs/PRD.md, RF-017). A client who writes again after a resolved
  // conversation gets a new ticket; its old messages stay visible here.
  const contactTickets = await Ticket.findAll({
    where: { contactId: ticket.contactId, companyId },
    attributes: ["id"]
  });
  const ticketIds = Array.from(
    new Set([ticket.id, ...contactTickets.map(t => t.id)])
  );

  const conditions: WhereOptions[] = [
    { ticketId: { [Op.in]: ticketIds } },
    { companyId },
    {
      mediaType: {
        [Op.or]: {
          [Op.ne]: "reactionMessage",
          [Op.is]: null
        }
      }
    }
  ];

  if (
    !viewer.isAdmin &&
    (await GetCompanySetting(companyId, "messageVisibility", "message")) ===
      "message"
  ) {
    // the queue privacy holds for the client's other tickets; inside this
    // ticket everything shows, so a transfer keeps its context
    conditions.push({
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

  const options: FindOptions = {
    where: { [Op.and]: conditions }
  };
  // The same client/office/sector fence applies to cursors and associations.
  // Keep this copy free of pagination predicates for quoted messages/replies.
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
        where: { [Op.and]: contextConditions },
        required: false
      },
      {
        model: Message,
        as: "replies",
        where: { [Op.and]: contextConditions },
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

  return {
    messages: visibleMessages.reverse(),
    ticket,
    count: null,
    hasMore,
    nextId: hasMore && oldestMessage ? oldestMessage.id : null
  };
};

export default ListMessagesService;
