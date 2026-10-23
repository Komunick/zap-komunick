import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
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
  contactId?: number;
  companyId?: number;
  ticketId?: number;
  userId?: number;
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
}

const UpdateUserService = async ({
  scheduleData,
  id,
  companyId
}: Request): Promise<Schedule | undefined> => {
  const schedule = await ShowService(id, companyId);

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  const schema = Yup.object().shape({
    body: Yup.string().min(5)
  });

  const { body, sendAt, sentAt, contactId, ticketId, userId } = scheduleData;

  try {
    await schema.validate({ body });
  } catch (err: any) {
    throw new AppError(err.message);
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
    contactId,
    ticketId,
    userId,
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
