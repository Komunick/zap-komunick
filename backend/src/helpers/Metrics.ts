import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO
} from "date-fns";

// Zap Komunick: metrics panel (docs/PRD.md, RF-015). Pure parts: the period,
// the filters and the shapes that the SQL rows are turned into.

export const METRICS_MAX_DAYS = 366;

export interface MetricsQuery {
  from?: unknown;
  to?: unknown;
  queueId?: unknown;
  userId?: unknown;
}

export interface MetricsParams {
  from: string;
  to: string;
  days: number;
  queueId: number | null;
  userId: number | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalId = (value: unknown): number | null | false => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : false;
};

/**
 * Reads GET /metrics. The period is inclusive on both days; without dates it
 * is the last 30 days up to today.
 */
export function parseMetricsQuery(
  query: MetricsQuery,
  today: Date = new Date()
): { params?: MetricsParams; error?: string } {
  const to =
    query.to === undefined || query.to === ""
      ? format(today, "yyyy-MM-dd")
      : query.to;
  const validDate = (value: unknown): value is string =>
    typeof value === "string" && DATE.test(value) && isValid(parseISO(value));
  if (!validDate(to)) {
    return { error: "ERR_METRICS_INVALID_DATE" };
  }
  const from =
    query.from === undefined || query.from === ""
      ? format(addDays(parseISO(to), -29), "yyyy-MM-dd")
      : query.from;

  if (!validDate(from)) {
    return { error: "ERR_METRICS_INVALID_DATE" };
  }
  if (from > to) {
    return { error: "ERR_METRICS_DATES_REVERSED" };
  }
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (days > METRICS_MAX_DAYS) {
    return { error: "ERR_METRICS_PERIOD_TOO_LONG" };
  }

  const queueId = optionalId(query.queueId);
  const userId = optionalId(query.userId);
  if (queueId === false || userId === false) {
    return { error: "ERR_METRICS_INVALID_FILTER" };
  }

  return { params: { from, to, days, queueId, userId } };
}

export interface DayRow {
  day: string;
  created?: number | string | null;
  finished?: number | string | null;
}

/** One entry per day of the period, zero where nothing happened. */
export function fillDays(
  from: string,
  days: number,
  rows: DayRow[]
): { day: string; created: number; finished: number }[] {
  const byDay = new Map(rows.map(r => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = format(addDays(parseISO(from), i), "yyyy-MM-dd");
    const row = byDay.get(day);
    return {
      day,
      created: Number(row?.created) || 0,
      finished: Number(row?.finished) || 0
    };
  });
}

/** 7 x 24 counts (Sunday first), from rows of weekday/hour/count. */
export function buildHeatmap(
  rows: {
    weekday: number | string;
    hour: number | string;
    count: number | string;
  }[]
): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  rows.forEach(row => {
    const weekday = Number(row.weekday);
    const hour = Number(row.hour);
    if (weekday >= 0 && weekday < 7 && hour >= 0 && hour < 24) {
      grid[weekday][hour] += Number(row.count) || 0;
    }
  });
  return grid;
}

/** Share in percent with one decimal, or null when there is no base. */
export const percent = (part: number, total: number): number | null =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : null;

/** Average in seconds from SQL, rounded; null when there is no data. */
export const seconds = (value: unknown): number | null => {
  const n = Number(value);
  return value === null || value === undefined || Number.isNaN(n)
    ? null
    : Math.round(n);
};
