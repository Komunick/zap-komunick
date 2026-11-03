import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import Contact from "../../models/Contact";
import { isValidRecurrence } from "../../helpers/ScheduleRecurrence";

interface Request {
  body: string;
  sendAt: Date;
  contactId: number;
  companyId: number;
  userId?: number;
  saveMessage?: boolean;
  recurrence?: string;
  recurrenceEndAt?: Date | string | null;
}

export const validateRecurrence = (
  recurrence: string,
  sendAt: Date | string,
  recurrenceEndAt?: Date | string | null
) => {
  if (!isValidRecurrence(recurrence)) {
    throw new AppError("ERR_INVALID_RECURRENCE");
  }
  if (
    recurrence !== "none" &&
    recurrenceEndAt &&
    new Date(recurrenceEndAt).getTime() < new Date(sendAt).getTime()
  ) {
    throw new AppError("ERR_INVALID_RECURRENCE_END");
  }
};

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  saveMessage,
  recurrence = "none",
  recurrenceEndAt = null
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err) {
    throw new AppError(err.message);
  }

  validateRecurrence(recurrence, sendAt, recurrenceEndAt);
  const repeats = recurrence !== "none";

  const schedule = await Schedule.create({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    saveMessage,
    status: "PENDENTE",
    recurrence,
    recurrenceEndAt:
      repeats && recurrenceEndAt ? new Date(recurrenceEndAt) : null,
    recurrenceAnchorAt: repeats ? sendAt : null
  });

  await schedule.reload({
    include: [{ model: Contact, as: "contact" }]
  });

  return schedule;
};

export default CreateService;
