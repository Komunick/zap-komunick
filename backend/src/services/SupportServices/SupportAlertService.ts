import { Op, col } from "sequelize";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import SupportTicket from "../../models/SupportTicket";
import { supportNumber } from "../../helpers/SupportRules";
import {
  SUPPORT_ALERT_SETTING,
  newSupportAlertToken,
  supportAlertTokenMatches
} from "../../helpers/SupportAlert";

// Zap Komunick: what the Windows alert of the support desk reads (RF-030).
// Super settings live in the first company, under keys that start with "_".
const SUPER_COMPANY = 1;
const FEED_LIMIT = 20;

const where = { companyId: SUPER_COMPANY, key: SUPPORT_ALERT_SETTING };

/** Creates a new key and invalidates the previous one. Shown only this once. */
export const rotateSupportAlertToken = async (): Promise<string> => {
  const { token, hash } = newSupportAlertToken();
  const [setting] = await Setting.findOrCreate({
    where,
    defaults: { ...where, value: hash } as Setting
  });
  if (setting.value !== hash) await setting.update({ value: hash });
  return token;
};

export const revokeSupportAlertToken = async (): Promise<void> => {
  await Setting.destroy({ where });
};

// What support has not read yet: a new ticket, or a message of the requester
// after the last time someone of support opened the ticket.
const waiting = {
  lastRequesterMessageAt: { [Op.ne]: null },
  [Op.or]: [
    { supportReadAt: null },
    { lastRequesterMessageAt: { [Op.gt]: col("supportReadAt") } }
  ]
};

export const supportAlertFeed = async (token: string | null) => {
  const setting = await Setting.findOne({ where });
  // Same answer for a missing, wrong or revoked key.
  if (!supportAlertTokenMatches(token, setting?.value))
    throw new AppError("ERR_SUPPORT_ALERT_UNAUTHORIZED", 401);

  const [unread, tickets] = await Promise.all([
    SupportTicket.count({ where: waiting }),
    SupportTicket.findAll({
      where: waiting,
      attributes: [
        "id",
        "title",
        "companyName",
        "userName",
        "priority",
        "lastRequesterMessageAt",
        "lastSupportMessageAt"
      ],
      order: [
        ["lastRequesterMessageAt", "DESC"],
        ["id", "DESC"]
      ],
      limit: FEED_LIMIT
    })
  ]);

  return {
    unread,
    tickets: tickets.map(ticket => ({
      id: ticket.id,
      number: supportNumber(ticket.id),
      title: ticket.title,
      companyName: ticket.companyName || null,
      userName: ticket.userName || null,
      priority: ticket.priority,
      // "new": nobody of support has written or acted on it yet.
      kind: ticket.lastSupportMessageAt ? "message" : "new",
      at: ticket.lastRequesterMessageAt
    }))
  };
};
