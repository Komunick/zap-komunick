// Zap Komunick: per user access hours (docs/PRD.md, RF-005)

export interface AccessHours {
  // 0 = Sunday ... 6 = Saturday
  weekdays: number[];
  // "HH:mm", server local time
  start: string;
  end: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * Validates the access hours sent by the client. Empty values mean "no
 * restriction" and become null.
 */
export function normalizeAccessHours(value: unknown): AccessHours | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "object") {
    throw new Error("ERR_INVALID_ACCESS_HOURS");
  }

  const { weekdays, start, end } = value as Partial<AccessHours>;

  if (
    !Array.isArray(weekdays) ||
    weekdays.length === 0 ||
    !weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
  ) {
    throw new Error("ERR_INVALID_ACCESS_HOURS");
  }

  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !TIME_PATTERN.test(start) ||
    !TIME_PATTERN.test(end) ||
    start === end
  ) {
    throw new Error("ERR_INVALID_ACCESS_HOURS");
  }

  return {
    weekdays: [...new Set(weekdays)].sort(),
    start,
    end
  };
}

/**
 * Whether the user may access the system at the given moment. A range that
 * ends before it starts (e.g. 22:00 to 06:00) crosses midnight and belongs to
 * the weekday on which it starts.
 */
export function isWithinAccessHours(
  hours: AccessHours | null | undefined,
  now: Date
): boolean {
  if (!hours) {
    return true;
  }

  const day = now.getDay();
  const previousDay = (day + 6) % 7;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);

  if (start < end) {
    return hours.weekdays.includes(day) && current >= start && current < end;
  }

  return (
    (hours.weekdays.includes(day) && current >= start) ||
    (hours.weekdays.includes(previousDay) && current < end)
  );
}

/**
 * Whether the user may sign in now. Administrators and super users are never
 * blocked, so the company cannot lock itself out.
 */
export function canAccessNow(
  user: {
    profile?: string;
    super?: boolean;
    accessHours?: AccessHours | null;
  },
  now: Date = new Date()
): boolean {
  if (user.profile === "admin" || user.super) {
    return true;
  }
  return isWithinAccessHours(user.accessHours, now);
}
