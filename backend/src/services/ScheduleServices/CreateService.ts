import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import sequelize from "../../database";
import { isValidRecurrence } from "../../helpers/ScheduleRecurrence";
import { nextBusinessDay } from "../../helpers/BusinessDays";
import {
  isValidScheduleMediaPath,
  mergeRecipients
} from "../../helpers/ScheduleTargets";

interface Request {
  body: string;
  sendAt: Date;
  contactId?: number;
  companyId: number;
  userId?: number;
  saveMessage?: boolean;
  recurrence?: string;
  recurrenceEndAt?: Date | string | null;
  // Zap Komunick: several recipients, attachment and business days
  contactIds?: unknown[];
  tagId?: number | string | null;
  mediaPath?: string | null;
  mediaName?: string | null;
  businessDaysOnly?: boolean;
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

export const validateScheduleMedia = (
  mediaPath: string | null | undefined,
  companyId: number
) => {
  if (mediaPath && !isValidScheduleMediaPath(mediaPath, companyId)) {
    throw new AppError("ERR_INVALID_SCHEDULE_MEDIA");
  }
};

/** Send moment of a schedule: the next business day when asked for. */
export const effectiveSendAt = (
  sendAt: Date | string,
  businessDaysOnly?: boolean
): Date =>
  businessDaysOnly ? nextBusinessDay(new Date(sendAt)) : new Date(sendAt);

const resolveRecipients = async (
  companyId: number,
  contactIds: unknown[],
  tagId?: number | string | null
): Promise<number[]> => {
  let tagContactIds: number[] = [];
  if (tagId) {
    const tag = await Tag.findOne({ where: { id: tagId, companyId } });
    if (!tag) {
      throw new AppError("ERR_NO_TAG_FOUND", 404);
    }
    tagContactIds = (
      await ContactTag.findAll({ where: { tagId: tag.id }, attributes: ["contactId"] })
    ).map(item => item.contactId);
  }

  let ids: number[];
  try {
    ids = mergeRecipients(contactIds, tagContactIds);
  } catch (error) {
    throw new AppError(error.message, 400);
  }

  // only contacts of the company
  const contacts = await Contact.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["id"]
  });
  if (contacts.length === 0) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }
  return contacts.map(contact => contact.id);
};

/**
 * Creates the same schedule for each recipient (chosen contacts and the
 * contacts of a tag).
 */
export const CreateSchedulesService = async ({
  body,
  sendAt,
  contactId,
  contactIds = [],
  tagId,
  companyId,
  userId,
  saveMessage,
  recurrence = "none",
  recurrenceEndAt = null,
  mediaPath = null,
  mediaName = null,
  businessDaysOnly = false
}: Request): Promise<Schedule[]> => {
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
  validateScheduleMedia(mediaPath, companyId);

  const recipients = await resolveRecipients(
    companyId,
    contactId ? [contactId, ...contactIds] : contactIds,
    tagId
  );

  const repeats = recurrence !== "none";
  const requestedAt = new Date(sendAt);

  const created = await sequelize.transaction(async transaction =>
    Schedule.bulkCreate(
      recipients.map(recipientId => ({
        body,
        sendAt: effectiveSendAt(requestedAt, businessDaysOnly),
        contactId: recipientId,
        companyId,
        userId,
        saveMessage,
        status: "PENDENTE",
        recurrence,
        recurrenceEndAt:
          repeats && recurrenceEndAt ? new Date(recurrenceEndAt) : null,
        // the series follows the requested date, not the shifted one
        recurrenceAnchorAt: repeats ? requestedAt : null,
        mediaPath: mediaPath || null,
        mediaName: mediaPath ? mediaName || null : null,
        businessDaysOnly: !!businessDaysOnly
      })),
      { transaction }
    )
  );

  return Schedule.findAll({
    where: { id: { [Op.in]: created.map(schedule => schedule.id) } },
    include: [{ model: Contact, as: "contact" }],
    order: [["id", "ASC"]]
  });
};

const CreateService = async (request: Request): Promise<Schedule> => {
  const [schedule] = await CreateSchedulesService({
    ...request,
    contactIds: [],
    tagId: null
  });
  return schedule;
};

export default CreateService;
