import {
  brazilianHolidays,
  easterSunday,
  holidayOn,
  isBusinessDay,
  nextBusinessDay
} from "../../helpers/BusinessDays";

// local time helper (month is 1-based for readability)
const d = (year: number, month: number, day: number, hour = 9, minute = 30) =>
  new Date(year, month - 1, day, hour, minute);

describe("easterSunday", () => {
  it.each([
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2038, 4, 25]
  ])("finds Easter of %i", (year, month, day) => {
    expect(easterSunday(year)).toEqual(new Date(year, month - 1, day));
  });
});

describe("brazilianHolidays", () => {
  it("includes the movable days off of 2026", () => {
    const dates = brazilianHolidays(2026).map(h => h.date);
    expect(dates).toEqual(
      expect.arrayContaining([
        "2026-02-16", // Carnival Monday
        "2026-02-17", // Carnival Tuesday
        "2026-04-03", // Good Friday
        "2026-06-04" // Corpus Christi
      ])
    );
  });

  it("includes Black Consciousness Day only from 2024 on", () => {
    expect(holidayOn(d(2024, 11, 20))?.name).toMatch(/Consciência Negra/);
    expect(holidayOn(d(2023, 11, 20))).toBeNull();
  });

  it("lists 13 days off in 2026", () => {
    expect(brazilianHolidays(2026)).toHaveLength(13);
  });
});

describe("isBusinessDay", () => {
  it("accepts a regular weekday", () => {
    expect(isBusinessDay(d(2026, 10, 21))).toBe(true);
  });

  it("refuses weekends", () => {
    expect(isBusinessDay(d(2026, 10, 24))).toBe(false);
    expect(isBusinessDay(d(2026, 10, 25))).toBe(false);
  });

  it("refuses holidays on weekdays", () => {
    expect(isBusinessDay(d(2026, 10, 12))).toBe(false); // Monday, Aparecida
    expect(isBusinessDay(d(2026, 6, 4))).toBe(false); // Corpus Christi
  });
});

describe("nextBusinessDay", () => {
  it("keeps a business day as it is", () => {
    expect(nextBusinessDay(d(2026, 10, 21))).toEqual(d(2026, 10, 21));
  });

  it("moves a Saturday to Monday at the same time", () => {
    expect(nextBusinessDay(d(2026, 10, 24, 8, 15))).toEqual(
      d(2026, 10, 26, 8, 15)
    );
  });

  it("skips a weekend followed by a holiday", () => {
    // Sat 10/10/2026, Sun 11, Mon 12 is Aparecida -> Tue 13
    expect(nextBusinessDay(d(2026, 10, 10))).toEqual(d(2026, 10, 13));
  });

  it("skips the whole Carnival", () => {
    // Sat 14/02/2026 -> Wed 18/02/2026
    expect(nextBusinessDay(d(2026, 2, 14))).toEqual(d(2026, 2, 18));
  });

  it("moves Good Friday to Monday", () => {
    expect(nextBusinessDay(d(2026, 4, 3))).toEqual(d(2026, 4, 6));
  });
});
