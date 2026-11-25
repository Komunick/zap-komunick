import { Op, Transaction, WhereOptions } from "sequelize";
import { GetCompanySetting } from "./CheckSettings";
import Queue from "../models/Queue";
import Setting from "../models/Setting";
import Whatsapp from "../models/Whatsapp";

export const GENERAL_TRIAGE_QUEUE = "generalTriageQueueId";
export const GENERAL_TRIAGE_TIMEOUT = "generalTriageTimeoutMinutes";
export const DEFAULT_GENERAL_TRIAGE_MINUTES = 15;

export const parseGeneralTriageInteger = (
  value: unknown,
  maximum: number
): number | null => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= maximum
    ? number
    : null;
};

export const readGeneralTriageQueueId = async (
  companyId: number,
  transaction?: Transaction
) => {
  const values = await Setting.findAll({
    attributes: ["value"],
    where: { companyId, key: GENERAL_TRIAGE_QUEUE },
    transaction
  });
  const first = values[0]?.value;
  return first && values.every(setting => setting.value === first)
    ? parseGeneralTriageInteger(first, 2147483647)
    : null;
};

export const readGeneralTriageTimeout = async (companyId: number) =>
  parseGeneralTriageInteger(
    await GetCompanySetting(companyId, GENERAL_TRIAGE_TIMEOUT, "15"),
    1440
  ) ?? DEFAULT_GENERAL_TRIAGE_MINUTES;

// Zap Komunick: WHO SEES A CONVERSATION THAT IS WAITING FOR A SECTOR
// (docs/PRD.md, RF-033).
//
// While the customer has not picked a sector from the menu, the ticket has no
// queue. Tickets without a queue belong to administrators only, so for the
// whole wait (15 minutes by default) the attendants could not see a customer
// who was writing to them, and watched the phone instead.
//
// The rule: a ticket WAITING IN GENERAL TRIAGE counts as being in the general
// queue for whoever belongs to that queue. They are the people who receive it
// when the wait ends anyway; this only takes the delay away. It is one rule,
// read by the list, by the access check and by the live events.
//
// Nothing else about tickets without a queue changes: the ones that are not
// in this wait (started from the phone, older than the triage) stay with the
// administrators.

export interface GeneralTriageScope {
  // the general queue of the company
  queueId: number;
  // the WhatsApp connections linked to it: only their tickets are in triage
  whatsappIds: number[];
}

export const loadGeneralTriageScope = async (
  companyId: number,
  transaction?: Transaction
): Promise<GeneralTriageScope | null> => {
  const queueId = await readGeneralTriageQueueId(companyId, transaction);
  if (!queueId) return null;
  const channels = await Whatsapp.findAll({
    attributes: ["id"],
    where: { companyId, channel: "whatsapp" },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: [],
        where: { id: queueId, companyId },
        through: { attributes: [] },
        required: true
      }
    ],
    ...(transaction ? { transaction } : {})
  });
  if (!channels.length) return null;
  return { queueId, whatsappIds: channels.map(({ id }) => id) };
};

// The scope, only for someone who belongs to the general queue.
export const loadMemberGeneralTriageScope = async (
  companyId: number,
  queueIds: number[],
  transaction?: Transaction
): Promise<GeneralTriageScope | null> => {
  if (!queueIds.length) return null;
  const scope = await loadGeneralTriageScope(companyId, transaction);
  return scope && queueIds.includes(scope.queueId) ? scope : null;
};

export interface GeneralTriageTicket {
  status: string;
  channel?: string | null;
  isGroup?: boolean | null;
  queueId?: number | null;
  userId?: number | null;
  generalTriageStartedAt?: Date | string | null;
  whatsappId?: number | null;
}

export const isWaitingInGeneralTriage = (
  ticket: GeneralTriageTicket | null | undefined,
  scope: GeneralTriageScope | null | undefined
): boolean =>
  !!ticket &&
  !!scope &&
  ticket.status === "pending" &&
  ticket.channel === "whatsapp" &&
  ticket.isGroup === false &&
  ticket.queueId == null &&
  ticket.userId == null &&
  ticket.generalTriageStartedAt != null &&
  ticket.whatsappId != null &&
  scope.whatsappIds.includes(ticket.whatsappId);

// The same rule as a filter of the Tickets table.
export const generalTriageWaitWhere = (
  scope: GeneralTriageScope
): WhereOptions => ({
  status: "pending",
  channel: "whatsapp",
  isGroup: false,
  queueId: null,
  userId: null,
  generalTriageStartedAt: { [Op.ne]: null },
  whatsappId: { [Op.in]: scope.whatsappIds }
});
