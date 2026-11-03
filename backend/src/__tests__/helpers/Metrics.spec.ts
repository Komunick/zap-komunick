import {
  buildHeatmap,
  fillDays,
  METRICS_MAX_DAYS,
  parseMetricsQuery,
  percent,
  seconds
} from "../../helpers/Metrics";

const today = new Date(2026, 9, 27, 10, 0);

describe("parseMetricsQuery", () => {
  it("uses the last 30 days up to today by default", () => {
    expect(parseMetricsQuery({}, today).params).toEqual({
      from: "2026-09-28",
      to: "2026-10-27",
      days: 30,
      queueId: null,
      userId: null
    });
  });

  it("counts both ends of the period", () => {
    expect(
      parseMetricsQuery({ from: "2026-10-01", to: "2026-10-01" }, today).params
        .days
    ).toBe(1);
  });

  it("refuses malformed, reversed or too long periods", () => {
    expect(parseMetricsQuery({ from: "01/10/2026" }, today).error).toBe(
      "ERR_METRICS_INVALID_DATE"
    );
    expect(parseMetricsQuery({ to: "2026-02-30" }, today).error).toBe(
      "ERR_METRICS_INVALID_DATE"
    );
    expect(
      parseMetricsQuery({ from: "2026-10-20", to: "2026-10-01" }, today).error
    ).toBe("ERR_METRICS_DATES_REVERSED");
    expect(
      parseMetricsQuery({ from: "2025-01-01", to: "2026-10-27" }, today).error
    ).toBe("ERR_METRICS_PERIOD_TOO_LONG");
    expect(METRICS_MAX_DAYS).toBe(366);
  });

  it("reads the queue and attendant filters", () => {
    const { params } = parseMetricsQuery({ queueId: "5", userId: 4 }, today);
    expect(params.queueId).toBe(5);
    expect(params.userId).toBe(4);
    expect(parseMetricsQuery({ queueId: "x" }, today).error).toBe(
      "ERR_METRICS_INVALID_FILTER"
    );
  });
});

describe("fillDays", () => {
  it("fills the days without data with zero", () => {
    expect(
      fillDays("2026-10-01", 3, [
        { day: "2026-10-02", created: "4", finished: 1 }
      ])
    ).toEqual([
      { day: "2026-10-01", created: 0, finished: 0 },
      { day: "2026-10-02", created: 4, finished: 1 },
      { day: "2026-10-03", created: 0, finished: 0 }
    ]);
  });
});

describe("buildHeatmap", () => {
  it("puts each count in its weekday and hour, ignoring invalid cells", () => {
    const grid = buildHeatmap([
      { weekday: 1, hour: 9, count: "3" },
      { weekday: "1", hour: "9", count: 2 },
      { weekday: 6, hour: 23, count: 1 },
      { weekday: 9, hour: 2, count: 7 }
    ]);
    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(24);
    expect(grid[1][9]).toBe(5);
    expect(grid[6][23]).toBe(1);
    expect(grid.flat().reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe("percent and seconds", () => {
  it("rounds the share to one decimal and has no share without base", () => {
    expect(percent(2, 3)).toBe(66.7);
    expect(percent(0, 0)).toBeNull();
  });

  it("rounds averages and keeps the missing ones as null", () => {
    expect(seconds("125.6")).toBe(126);
    expect(seconds(null)).toBeNull();
    expect(seconds("x")).toBeNull();
  });
});
