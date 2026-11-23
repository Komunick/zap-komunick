import { Transaction } from "sequelize";
import { GetCompanySetting } from "./CheckSettings";
import Setting from "../models/Setting";

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
