import { classifySla, parseSlaConfig } from "../../helpers/SlaRules";

const now = new Date("2026-10-21T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60000);

describe("classifySla", () => {
  const config = { slaMinutes: 30, oldTicketHours: 72 };

  it("is within the deadline while the wait does not exceed the SLA", () => {
    const result = classifySla(
      { status: "open", unansweredSince: minutesAgo(30), openedAt: now },
      config,
      now
    );

    expect(result).toEqual({
      waiting: true,
      waitingMinutes: 30,
      breached: false,
      old: false,
      situation: "ok"
    });
  });

  it("breaches once the wait goes past the SLA", () => {
    const result = classifySla(
      { status: "pending", unansweredSince: minutesAgo(31), openedAt: now },
      config,
      now
    );

    expect(result.breached).toBe(true);
    expect(result.situation).toBe("breached");
    expect(result.waitingMinutes).toBe(31);
  });

  it("does not breach when the client already got a reply", () => {
    const result = classifySla(
      { status: "open", unansweredSince: null, openedAt: minutesAgo(600) },
      config,
      now
    );

    expect(result.waiting).toBe(false);
    expect(result.breached).toBe(false);
    expect(result.situation).toBe("ok");
  });

  it("does not breach while the chatbot is handling the ticket", () => {
    const result = classifySla(
      {
        status: "pending",
        chatbot: true,
        unansweredSince: minutesAgo(500),
        openedAt: now
      },
      config,
      now
    );

    expect(result.waiting).toBe(false);
    expect(result.breached).toBe(false);
  });

  it("never breaches when the SLA is disabled", () => {
    const result = classifySla(
      { status: "open", unansweredSince: minutesAgo(10000), openedAt: now },
      { slaMinutes: 0, oldTicketHours: 72 },
      now
    );

    expect(result.waiting).toBe(true);
    expect(result.breached).toBe(false);
  });

  it("flags tickets open for more than the old ticket threshold", () => {
    const result = classifySla(
      {
        status: "open",
        unansweredSince: null,
        openedAt: minutesAgo(72 * 60 + 1)
      },
      config,
      now
    );

    expect(result.old).toBe(true);
    expect(result.situation).toBe("old");
  });

  it("keeps exactly 72 hours as not old", () => {
    const result = classifySla(
      { status: "open", openedAt: minutesAgo(72 * 60) },
      config,
      now
    );

    expect(result.old).toBe(false);
  });

  it("prefers the breached situation over the old one", () => {
    const result = classifySla(
      {
        status: "open",
        unansweredSince: minutesAgo(45),
        openedAt: minutesAgo(80 * 60)
      },
      config,
      now
    );

    expect(result.old).toBe(true);
    expect(result.breached).toBe(true);
    expect(result.situation).toBe("breached");
  });

  it("ignores closed tickets", () => {
    const result = classifySla(
      {
        status: "closed",
        unansweredSince: minutesAgo(500),
        openedAt: minutesAgo(9000)
      },
      config,
      now
    );

    expect(result).toEqual({
      waiting: false,
      waitingMinutes: null,
      breached: false,
      old: false,
      situation: "ok"
    });
  });

  it("accepts ISO strings as dates", () => {
    const result = classifySla(
      {
        status: "open",
        unansweredSince: minutesAgo(40).toISOString(),
        openedAt: now.toISOString()
      },
      config,
      now
    );

    expect(result.breached).toBe(true);
  });
});

describe("parseSlaConfig", () => {
  it("parses numeric settings", () => {
    expect(parseSlaConfig("45", "48")).toEqual({
      slaMinutes: 45,
      oldTicketHours: 48
    });
  });

  it("disables the SLA and keeps 72 hours when settings are missing", () => {
    expect(parseSlaConfig(undefined, undefined)).toEqual({
      slaMinutes: 0,
      oldTicketHours: 72
    });
  });

  it("falls back on invalid values", () => {
    expect(parseSlaConfig("abc", "-3")).toEqual({
      slaMinutes: 0,
      oldTicketHours: 72
    });
  });
});
