import { addDays, addMonths, addWeeks, addYears } from "date-fns";

// Zap Komunick: recurring scheduled messages (docs/PRD.md, RF-006)

export const SCHEDULE_RECURRENCES = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly"
] as const;

export type ScheduleRecurrence = (typeof SCHEDULE_RECURRENCES)[number];

const adders: Record<
  Exclude<ScheduleRecurrence, "none">,
  (date: Date, amount: number) => Date
> = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears
};

// enough for decades of daily messages; protects against bad data
const MAX_STEPS = 50000;

export function isValidRecurrence(value: unknown): value is ScheduleRecurrence {
  return SCHEDULE_RECURRENCES.includes(value as ScheduleRecurrence);
}

/**
 * Next send date of a series after the given moment. Occurrences are always
 * computed from the first one (anchor), so a series on the 31st goes to the
 * last day of shorter months and comes back to the 31st afterwards. Missed
 * occurrences (e.g. the server was down) are skipped. Returns null when the
 * series does not repeat or has ended.
 */
export function nextOccurrence(
  anchor: Date,
  recurrence: string,
  after: Date,
  endAt?: Date | null
): Date | null {
  if (!isValidRecurrence(recurrence) || recurrence === "none") {
    return null;
  }

  const add = adders[recurrence];

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    const candidate = add(anchor, step);
    if (candidate.getTime() > after.getTime()) {
      if (endAt && candidate.getTime() > endAt.getTime()) {
        return null;
      }
      return candidate;
    }
  }

  return null;
}
