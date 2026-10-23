import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Schedule from "../../models/Schedule";
import { nextOccurrence } from "../../helpers/ScheduleRecurrence";
import { nextBusinessDay } from "../../helpers/BusinessDays";

// Zap Komunick: creates the next send of a recurring schedule after the current
// one was processed (docs/PRD.md, RF-006)
const CreateNextOccurrenceService = async (
  schedule: Schedule,
  now: Date = new Date()
): Promise<Schedule | null> => {
  if (!schedule?.recurrence || schedule.recurrence === "none") {
    return null;
  }

  const anchor = new Date(schedule.recurrenceAnchorAt || schedule.sendAt);
  const after = new Date(
    Math.max(now.getTime(), new Date(schedule.sendAt).getTime())
  );

  const sendAt = nextOccurrence(
    anchor,
    schedule.recurrence,
    after,
    schedule.recurrenceEndAt ? new Date(schedule.recurrenceEndAt) : null
  );

  if (!sendAt) {
    return null;
  }

  // Zap Komunick: business days (docs/PRD.md, RF-008)
  const finalSendAt = schedule.businessDaysOnly
    ? nextBusinessDay(sendAt)
    : sendAt;

  const next = await Schedule.create({
    body: schedule.body,
    sendAt: finalSendAt,
    contactId: schedule.contactId,
    ticketId: schedule.ticketId,
    companyId: schedule.companyId,
    userId: schedule.userId,
    saveMessage: schedule.saveMessage,
    status: "PENDENTE",
    recurrence: schedule.recurrence,
    recurrenceEndAt: schedule.recurrenceEndAt,
    recurrenceAnchorAt: anchor,
    mediaPath: schedule.mediaPath,
    mediaName: schedule.mediaName,
    businessDaysOnly: schedule.businessDaysOnly
  });

  await next.reload({ include: [{ model: Contact, as: "contact" }] });

  const io = getIO();
  io.to(`company-${next.companyId}-mainchannel`).emit(
    `company-${next.companyId}-schedule`,
    {
      action: "create",
      schedule: next
    }
  );

  return next;
};

export default CreateNextOccurrenceService;
