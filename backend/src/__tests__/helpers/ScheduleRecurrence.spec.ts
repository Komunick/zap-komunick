import {
  isValidRecurrence,
  nextOccurrence
} from "../../helpers/ScheduleRecurrence";

// local time helper (month is 1-based for readability)
const d = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

describe("nextOccurrence", () => {
  it("does not repeat without recurrence", () => {
    expect(nextOccurrence(d(2026, 10, 1), "none", d(2026, 10, 1))).toBeNull();
  });

  it("does not repeat with an unknown recurrence", () => {
    expect(nextOccurrence(d(2026, 10, 1), "hourly", d(2026, 10, 1))).toBeNull();
  });

  it("repeats daily at the same time", () => {
    expect(nextOccurrence(d(2026, 10, 1), "daily", d(2026, 10, 1))).toEqual(
      d(2026, 10, 2)
    );
  });

  it("repeats weekly on the same weekday", () => {
    expect(nextOccurrence(d(2026, 10, 1), "weekly", d(2026, 10, 1))).toEqual(
      d(2026, 10, 8)
    );
  });

  it("repeats monthly on the same day", () => {
    expect(nextOccurrence(d(2026, 10, 10), "monthly", d(2026, 10, 10))).toEqual(
      d(2026, 11, 10)
    );
  });

  it("goes to the last day of shorter months and back to the 31st", () => {
    const anchor = d(2027, 1, 31);

    const february = nextOccurrence(anchor, "monthly", anchor);
    expect(february).toEqual(d(2027, 2, 28));

    const march = nextOccurrence(anchor, "monthly", february);
    expect(march).toEqual(d(2027, 3, 31));
  });

  it("repeats yearly, using February 28 outside leap years", () => {
    const anchor = d(2028, 2, 29);
    expect(nextOccurrence(anchor, "yearly", anchor)).toEqual(d(2029, 2, 28));
  });

  it("skips occurrences missed while the system was down", () => {
    expect(nextOccurrence(d(2026, 10, 1), "daily", d(2026, 10, 5, 12))).toEqual(
      d(2026, 10, 6)
    );
  });

  it("stops after the end date", () => {
    expect(
      nextOccurrence(d(2026, 10, 1), "monthly", d(2026, 10, 1), d(2026, 10, 31))
    ).toBeNull();
  });

  it("keeps an occurrence that falls exactly on the end date", () => {
    expect(
      nextOccurrence(d(2026, 10, 1), "weekly", d(2026, 10, 1), d(2026, 10, 8))
    ).toEqual(d(2026, 10, 8));
  });
});

describe("isValidRecurrence", () => {
  it("accepts the supported recurrences only", () => {
    ["none", "daily", "weekly", "monthly", "yearly"].forEach(value =>
      expect(isValidRecurrence(value)).toBe(true)
    );
    expect(isValidRecurrence("hourly")).toBe(false);
    expect(isValidRecurrence(undefined)).toBe(false);
  });
});
