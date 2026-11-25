import { Op, Sequelize } from "sequelize";
import {
  readGeneralTriageQueueId,
  readGeneralTriageTimeout
} from "../../helpers/GeneralTriage";
import { cacheLayer } from "../../libs/cache";
import { getIO } from "../../libs/socket";
import { removeTicketFromQueueLists } from "../SocketServices/TicketContextSocketService";
import { logger } from "../../utils/logger";
import IsWhatsAppQueueLinked from "../../helpers/IsWhatsAppQueueLinked";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { websocketUpdateTicket } from "../TicketServices/UpdateTicketService";

const awaitingSector = {
  status: "pending",
  channel: "whatsapp",
  isGroup: false,
  queueId: null,
  userId: null
};

export const startGeneralTriageWait = async (
  ticket: Ticket,
  chatbot: boolean
): Promise<boolean> => {
  const [updated] = await Ticket.update(
    {
      chatbot,
      generalTriageStartedAt: Sequelize.literal(
        'COALESCE("generalTriageStartedAt", "unansweredSince", CURRENT_TIMESTAMP)'
      )
    },
    {
      where: {
        ...awaitingSector,
        id: ticket.id,
        companyId: ticket.companyId,
        whatsappId: ticket.whatsappId
      }
    }
  );
  return updated === 1;
};

// The sector menu goes out once per wait. While the customer has not picked a
// sector, every new message reaches verifyQueue again; without this claim the
// menu was repeated on each message (twice in the same second when two
// messages arrived together). The claim lasts as long as the wait, so a ticket
// that waits again after the timeout gets the menu again. If Redis fails, the
// menu is sent as before rather than leaving the customer without options.
export const generalTriageMenuKey = (ticket: Ticket): string =>
  `general-triage-menu:${ticket.companyId}:${ticket.id}`;

export const claimGeneralTriageMenu = async (
  ticket: Ticket
): Promise<boolean> => {
  try {
    const minutes = await readGeneralTriageTimeout(ticket.companyId);
    return await cacheLayer.setIfAbsent(
      generalTriageMenuKey(ticket),
      "1",
      Math.max(60, minutes * 60)
    );
  } catch (err) {
    logger.warn(
      { ticketId: ticket.id, message: (err as Error)?.message },
      "General triage menu claim failed; sending the menu"
    );
    return true;
  }
};

export const assignGeneralTriageDestination = async (
  ticket: Ticket,
  destination: { id: number; chatbot: boolean; isGeneral: boolean },
  deadline?: Date
): Promise<Ticket | null> => {
  const { id, companyId, whatsappId } = ticket;
  const moved = await Ticket.sequelize.transaction(async transaction => {
    if (
      (destination.isGeneral &&
        (await readGeneralTriageQueueId(companyId, transaction)) !==
          destination.id) ||
      !(await IsWhatsAppQueueLinked(
        companyId,
        whatsappId,
        destination.id,
        transaction
      ))
    ) {
      return false;
    }

    const current = await Ticket.findOne({
      attributes: ["id", "generalTriageStartedAt", "unansweredSince"],
      where: { ...awaitingSector, id, companyId, whatsappId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!current) return false;

    const [changed] = await Ticket.update(
      {
        queueId: destination.id,
        chatbot: destination.chatbot,
        queueOptionId: null,
        generalTriageStartedAt: null
      },
      {
        where: {
          ...awaitingSector,
          id,
          companyId,
          whatsappId,
          ...(deadline && { generalTriageStartedAt: { [Op.lte]: deadline } })
        },
        transaction
      }
    );
    if (changed !== 1) return false;

    const firstInboundAt =
      current.generalTriageStartedAt ?? current.unansweredSince;
    if (firstInboundAt) {
      await Message.update(
        { queueId: destination.id },
        {
          where: {
            ticketId: id,
            companyId,
            channel: "whatsapp",
            fromMe: false,
            queueId: null,
            createdAt: { [Op.gte]: firstInboundAt },
            id: { [Op.notLike]: `%-${id}` }
          },
          transaction
        }
      );
    }

    const now = new Date();
    await TicketTraking.update(
      { queuedAt: now, ...(!destination.chatbot && { chatbotendAt: now }) },
      {
        where: {
          ticketId: id,
          companyId,
          finishedAt: null,
          startedAt: null,
          rated: false,
          expired: false
        },
        transaction
      }
    );
    return true;
  });
  if (!moved) return null;

  const routedTicket = await ShowTicketService(id, companyId);
  // Zap Komunick (RF-033): while it waited, the ticket was on the lists of the
  // general queue. When the customer picks another sector it leaves them; the
  // attendants who are also of the new sector get it back with the update.
  if (!destination.isGeneral) {
    try {
      await removeTicketFromQueueLists(
        getIO(),
        routedTicket,
        await readGeneralTriageQueueId(companyId)
      );
    } catch {
      /* The lists correct themselves on the next reload. */
    }
  }
  await websocketUpdateTicket(routedTicket);
  return routedTicket;
};
