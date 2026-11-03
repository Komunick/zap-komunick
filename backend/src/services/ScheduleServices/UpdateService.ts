import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import ShowService from "./ShowService";
import { validateRecurrence } from "./CreateService";

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
  const repeats = recurrence !== "none";
  // editing the date or the recurrence starts the series again from there;
  // other edits keep the original anchor (e.g. monthly on the 31st)
  const restartSeries =
    !schedule.recurrenceAnchorAt ||
    recurrence !== (schedule.recurrence || "none") ||
    new Date(effectiveSendAt).getTime() !== new Date(schedule.sendAt).getTime();

  await schedule.update({
    body,
    sendAt,
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
      : null
  });

  await schedule.reload();
  return schedule;
};

export default UpdateUserService;
