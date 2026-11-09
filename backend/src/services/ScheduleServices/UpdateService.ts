import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Schedule from "../../models/Schedule";
import User from "../../models/User";
import { loadTicketViewer } from "../TicketServices/AuthorizeTicketContextService";
import {
  parseScheduleReference,
  resolveStandaloneScheduleQueue,
  resolveTicketScheduleRoute
} from "./AuthorizeScheduleRouteService";
import ShowService from "./ShowService";
import {
  effectiveSendAt as businessSendAt,
  validateRecurrence,
  validateScheduleMedia
} from "./CreateService";

interface ScheduleData {
  id?: number;
  body?: string;
  sendAt?: Date;
  sentAt?: Date;
  contactId?: number | string | null;
  companyId?: number;
  ticketId?: number | string | null;
  queueId?: number | string | null;
  userId?: number | string | null;
  recurrence?: string;
  recurrenceEndAt?: Date | string | null;
  mediaPath?: string | null;
  mediaName?: string | null;
  businessDaysOnly?: boolean;
}

interface Request {
  scheduleData: ScheduleData;
  id: string | number;
  companyId: number;
  actorId: string | number;
}

const UpdateUserService = async ({
  scheduleData,
  id,
  companyId,
  actorId
}: Request): Promise<Schedule | undefined> => {
  const viewer = await loadTicketViewer({ companyId, userId: actorId });
  if (!viewer.isAdmin) throw new AppError("ERR_NO_PERMISSION", 403);

  const schedule = await ShowService(id, companyId);

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  const schema = Yup.object().shape({
    body: Yup.string().min(5)
  });

  const { body, sendAt, sentAt, contactId, ticketId, queueId, userId } =
    scheduleData;

  try {
    await schema.validate({ body });
  } catch (err) {
    throw new AppError(err.message);
  }

  const storedTicketId = schedule.ticketId ?? null;
  const requestedTicketId =
    ticketId === undefined
      ? storedTicketId
      : parseScheduleReference(ticketId, "ERR_SCHEDULE_TICKET_CONTEXT");
  const ticketRoute =
    storedTicketId !== null ||
    schedule.routingMode === "ticket" ||
    schedule.routingMode === "ticket_queue";
  if (
    requestedTicketId !== storedTicketId ||
    (ticketRoute && storedTicketId === null)
  ) {
    throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
  }

  const recipientId = parseScheduleReference(
    contactId === undefined ? schedule.contactId : contactId,
    "ERR_NO_CONTACT_FOUND"
  );
  const ownerId = parseScheduleReference(
    userId === undefined ? schedule.userId : userId,
    "ERR_NO_PERMISSION"
  );
  if (
    ownerId !== null &&
    !(await User.findOne({
      where: { id: ownerId, companyId },
      attributes: ["id"]
    }))
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const requestedQueueId =
    queueId === undefined
      ? (schedule.queueId ?? null)
      : parseScheduleReference(queueId, "ERR_SCHEDULE_QUEUE_REQUIRED");
  let scheduleQueueId: number | null;
  let routingMode: Schedule["routingMode"];
  if (ticketRoute) {
    const ticket = await resolveTicketScheduleRoute(viewer, storedTicketId);
    scheduleQueueId = ticket.queueId ?? null;
    const storedQueueId = schedule.queueId ?? null;
    if (
      recipientId !== ticket.contactId ||
      (queueId !== undefined && requestedQueueId !== scheduleQueueId) ||
      (schedule.routingMode === "ticket_queue" &&
        (storedQueueId === null || storedQueueId !== scheduleQueueId))
    ) {
      throw new AppError("ERR_SCHEDULE_TICKET_CONTEXT");
    }
    routingMode = scheduleQueueId === null ? "ticket" : "ticket_queue";
  } else {
    if (
      recipientId === null ||
      !(await Contact.findOne({
        where: { id: recipientId, companyId },
        attributes: ["id"]
      }))
    ) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }
    if (
      requestedQueueId === null &&
      (schedule.routingMode === "queue" || schedule.queueId != null)
    ) {
      throw new AppError("ERR_SCHEDULE_QUEUE_REQUIRED");
    }
    scheduleQueueId = await resolveStandaloneScheduleQueue(
      viewer,
      requestedQueueId
    );
    routingMode = scheduleQueueId === null ? null : "queue";
  }

  // Zap Komunick: recurrence (docs/PRD.md, RF-006)
  const recurrence = scheduleData.recurrence ?? schedule.recurrence ?? "none";
  const recurrenceEndAt =
    scheduleData.recurrenceEndAt !== undefined
      ? scheduleData.recurrenceEndAt
      : schedule.recurrenceEndAt;
  const effectiveSendAt = sendAt || schedule.sendAt;
  validateRecurrence(recurrence, effectiveSendAt, recurrenceEndAt);
  // Zap Komunick: attachment and business days (docs/PRD.md, RF-008)
  const businessDaysOnly =
    scheduleData.businessDaysOnly ?? schedule.businessDaysOnly ?? false;
  const businessDaysChanged =
    businessDaysOnly !== (schedule.businessDaysOnly ?? false);
  const mediaChanges: Partial<Schedule> = {};
  if (scheduleData.mediaPath !== undefined) {
    validateScheduleMedia(scheduleData.mediaPath, companyId);
    mediaChanges.mediaPath = scheduleData.mediaPath || null;
    mediaChanges.mediaName = scheduleData.mediaPath
      ? scheduleData.mediaName || null
      : null;
  }
  const repeats = recurrence !== "none";
  // editing the date or the recurrence starts the series again from there;
  // other edits keep the original anchor (e.g. monthly on the 31st)
  const restartSeries =
    !schedule.recurrenceAnchorAt ||
    recurrence !== (schedule.recurrence || "none") ||
    new Date(effectiveSendAt).getTime() !== new Date(schedule.sendAt).getTime();

  await schedule.update({
    body,
    sendAt:
      sendAt || businessDaysChanged
        ? businessSendAt(effectiveSendAt, businessDaysOnly)
        : undefined,
    sentAt,
    contactId: recipientId,
    queueId: scheduleQueueId,
    routingMode,
    userId: ownerId,
    recurrence,
    recurrenceEndAt:
      repeats && recurrenceEndAt ? new Date(recurrenceEndAt) : null,
    recurrenceAnchorAt: repeats
      ? restartSeries
        ? effectiveSendAt
        : schedule.recurrenceAnchorAt
      : null,
    businessDaysOnly,
    ...mediaChanges
  });

  await schedule.reload();
  return schedule;
};

export default UpdateUserService;
