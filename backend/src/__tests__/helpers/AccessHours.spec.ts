import {
  canAccessNow,
  isWithinAccessHours,
  normalizeAccessHours
} from "../../helpers/AccessHours";

// local time helpers: 2026-10-19 is a Monday
const at = (day: number, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 9, 18 + day, hours, minutes);
};

describe("isWithinAccessHours", () => {
  const weekdays = { weekdays: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" };

  it("allows access without restriction", () => {
    expect(isWithinAccessHours(null, at(0, "03:00"))).toBe(true);
  });

  it("allows access inside the range on an allowed day", () => {
    expect(isWithinAccessHours(weekdays, at(1, "08:00"))).toBe(true);
    expect(isWithinAccessHours(weekdays, at(5, "17:59"))).toBe(true);
  });

  it("blocks access before the start and from the end on", () => {
    expect(isWithinAccessHours(weekdays, at(1, "07:59"))).toBe(false);
    expect(isWithinAccessHours(weekdays, at(1, "18:00"))).toBe(false);
  });

  it("blocks access on a day that is not allowed", () => {
    expect(isWithinAccessHours(weekdays, at(6, "10:00"))).toBe(false);
    expect(isWithinAccessHours(weekdays, at(0, "10:00"))).toBe(false);
  });

  describe("range crossing midnight", () => {
    const night = { weekdays: [5], start: "22:00", end: "06:00" };

    it("allows the evening of the allowed day", () => {
      expect(isWithinAccessHours(night, at(5, "23:30"))).toBe(true);
    });

    it("allows the early morning after the allowed day", () => {
      expect(isWithinAccessHours(night, at(6, "05:59"))).toBe(true);
    });

    it("blocks the early morning of the allowed day itself", () => {
      expect(isWithinAccessHours(night, at(5, "05:00"))).toBe(false);
    });

    it("blocks from the end of the range on", () => {
      expect(isWithinAccessHours(night, at(6, "06:00"))).toBe(false);
    });
  });
});

describe("normalizeAccessHours", () => {
  it("turns empty values into no restriction", () => {
    expect(normalizeAccessHours(null)).toBeNull();
    expect(normalizeAccessHours(undefined)).toBeNull();
    expect(normalizeAccessHours("")).toBeNull();
  });

  it("sorts and removes repeated weekdays", () => {
    expect(
      normalizeAccessHours({
        weekdays: [5, 1, 1, 3],
        start: "08:00",
        end: "12:00"
      })
    ).toEqual({ weekdays: [1, 3, 5], start: "08:00", end: "12:00" });
  });

  it.each([
    [{ weekdays: [], start: "08:00", end: "18:00" }],
    [{ weekdays: [7], start: "08:00", end: "18:00" }],
    [{ weekdays: [1], start: "8:00", end: "18:00" }],
    [{ weekdays: [1], start: "08:00", end: "24:00" }],
    [{ weekdays: [1], start: "08:00", end: "08:00" }],
    [{ weekdays: "1,2", start: "08:00", end: "18:00" }],
    ["08:00-18:00"]
  ])("rejects invalid access hours %p", value => {
    expect(() => normalizeAccessHours(value)).toThrow(
      "ERR_INVALID_ACCESS_HOURS"
    );
  });
});

describe("canAccessNow", () => {
  const office = { weekdays: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" };
  const sunday = at(0, "10:00");

  it("blocks an attendant outside the access hours", () => {
    expect(canAccessNow({ profile: "user", accessHours: office }, sunday)).toBe(
      false
    );
  });

  it("allows an attendant inside the access hours", () => {
    expect(
      canAccessNow({ profile: "user", accessHours: office }, at(2, "09:00"))
    ).toBe(true);
  });

  it("never blocks administrators", () => {
    expect(
      canAccessNow({ profile: "admin", accessHours: office }, sunday)
    ).toBe(true);
  });

  it("never blocks super users", () => {
    expect(
      canAccessNow(
        { profile: "user", super: true, accessHours: office },
        sunday
      )
    ).toBe(true);
  });
});
