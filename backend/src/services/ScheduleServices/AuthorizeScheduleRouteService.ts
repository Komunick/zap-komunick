import AppError from "../../errors/AppError";
import {
  ticketContextError,
  TicketViewer
} from "../../helpers/TicketAccessRules";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";

export function parseScheduleReference(
  value: unknown,
  error: string
): number | null {
  if (value == null || value === "") return null;
  const id =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(error);
  }
  return id;
}

export async function resolveStandaloneScheduleQueue(
  viewer: TicketViewer,
  queueId: number | null
): Promise<number | null> {
  const { companyId } = viewer;
  if (queueId !== null) {
    const queue = await Queue.findOne({
      where: { id: queueId, companyId },
      attributes: ["id"]
    });
    if (!queue || (!viewer.isAdmin && !viewer.queueIds.includes(queue.id))) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    return queue.id;
  }

  if (!viewer.isAdmin && viewer.queueIds.length === 1) {
    return viewer.queueIds[0];
  }

  const queues = await Queue.findAll({
    where: { companyId },
    attributes: ["id"],
    limit: 2
  });
  if (queues.length === 0) return null;
  if (viewer.isAdmin && queues.length === 1) return queues[0].id;

  throw new AppError("ERR_SCHEDULE_QUEUE_REQUIRED");
}

export async function resolveTicketScheduleRoute(
  viewer: TicketViewer,
  ticketId: number
): Promise<Ticket> {
  const { companyId } = viewer;
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId, channel: "whatsapp" },
    attributes: ["id", "companyId", "contactId", "queueId", "whatsappId"]
  });
  if (!ticket?.whatsappId) {
    throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
  }
  const contact = await Contact.findOne({
    where: { id: ticket.contactId, companyId },
    attributes: ["id", "companyId"]
  });
  if (!contact) throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");

  const error = ticketContextError(ticket, viewer, contact.companyId);
  if (error === "ERR_NO_PERMISSION") throw new AppError(error, 403);
  if (error) throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");

  if (ticket.queueId != null) {
    const queue = await Queue.findOne({
      where: { id: ticket.queueId, companyId },
      attributes: ["id"]
    });
    if (!queue) throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
  }
  return ticket;
}
