import path from "path";
import AppError from "../../errors/AppError";
import { getPublicPath } from "../../helpers/GetPublicPath";
import GetQueueWhatsApp from "../../helpers/GetQueueWhatsApp";
import { mustacheFormat } from "../../helpers/Mustache";
import { isValidScheduleMediaPath } from "../../helpers/ScheduleTargets";
import { SendMessage } from "../../helpers/SendMessage";
import Contact from "../../models/Contact";
import Schedule from "../../models/Schedule";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getJidOf } from "../WbotServices/getJidOf";
import CreateNextOccurrenceService from "./CreateNextOccurrenceService";

async function getScheduledRoute(schedule: Schedule) {
  const { companyId, contactId, ticketId, queueId, routingMode } = schedule;
  if (
    (routingMode === "ticket" || routingMode === "ticket_queue") &&
    !ticketId
  ) {
    throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
  }
  if ((routingMode === "queue" || routingMode === "ticket_queue") && !queueId) {
    throw new AppError("ERR_SCHEDULE_QUEUE_REQUIRED");
  }

  let ticket: Ticket | null = null;
  if (ticketId) {
    ticket = await Ticket.findOne({
      where: { id: ticketId, companyId, contactId, channel: "whatsapp" },
      attributes: ["id", "whatsappId", "queueId"]
    });
    if (!ticket?.whatsappId || (queueId && ticket.queueId !== queueId)) {
      throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
    }
  }

  const targetQueueId = queueId ?? ticket?.queueId;
  if (targetQueueId) {
    const whatsapp = await GetQueueWhatsApp(
      companyId,
      targetQueueId,
      ticket?.whatsappId
    );
    return { whatsapp, queueId: targetQueueId };
  }

  const where = { companyId, channel: "whatsapp" };
  if (ticket) {
    const whatsapp = await Whatsapp.findOne({
      where: { ...where, id: ticket.whatsappId, status: "CONNECTED" },
      attributes: ["id", "companyId"]
    });
    if (!whatsapp) {
      throw new AppError("ERR_SCHEDULE_CHANNEL_UNAVAILABLE");
    }
    return { whatsapp };
  }

  // An old schedule without routing context has a safe sender only when
  // the company has a single WhatsApp, even if other channels are offline.
  const channels = await Whatsapp.findAll({
    where,
    attributes: ["id", "companyId", "status"],
    limit: 2
  });
  if (channels.length > 1) {
    throw new AppError("ERR_SCHEDULE_QUEUE_REQUIRED");
  }
  const [whatsapp] = channels;
  if (whatsapp?.status !== "CONNECTED") {
    throw new AppError("ERR_SCHEDULE_CHANNEL_UNAVAILABLE");
  }
  return { whatsapp };
}

const SendScheduledMessageService = async (id: number): Promise<boolean> => {
  const schedule = await Schedule.findByPk(id, {
    include: [
      { model: Contact, as: "contact" },
      { model: User, as: "user" }
    ]
  });
  if (!schedule || schedule.status !== "AGENDADA" || schedule.sentAt) {
    return false;
  }
  if (schedule.sendAt > new Date()) {
    await Schedule.update(
      { status: "PENDENTE" },
      {
        where: {
          id,
          companyId: schedule.companyId,
          status: "AGENDADA",
          sentAt: null,
          sendAt: schedule.sendAt
        }
      }
    );
    return false;
  }

  try {
    const { companyId, contact, user, body, mediaPath, saveMessage } = schedule;
    if (
      !contact ||
      contact.companyId !== companyId ||
      (contact.channel && contact.channel !== "whatsapp") ||
      (user && user.companyId !== companyId)
    ) {
      throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
    }
    if (mediaPath && !isValidScheduleMediaPath(mediaPath, companyId)) {
      throw new AppError("ERR_INVALID_SCHEDULE_MEDIA");
    }
    const route = await getScheduledRoute(schedule);
    await SendMessage(route.whatsapp, {
      number: contact.isGroup ? getJidOf(contact) : contact.number,
      body: mustacheFormat({ body, contact, currentUser: user }),
      saveOnTicket: saveMessage && (route.queueId ?? true),
      ...(mediaPath
        ? { mediaPath: path.resolve(getPublicPath(), mediaPath) }
        : {})
    });
    await schedule.update({ sentAt: new Date(), status: "ENVIADA" });
    return true;
  } catch (error) {
    await schedule.update({ status: "ERRO" });
    throw error;
  } finally {
    await CreateNextOccurrenceService(schedule).catch(error => {
      logger.error(
        { message: error?.message, scheduleId: id },
        "SendScheduledMessage -> CreateNextOccurrence: error"
      );
    });
  }
};

export default SendScheduledMessageService;
