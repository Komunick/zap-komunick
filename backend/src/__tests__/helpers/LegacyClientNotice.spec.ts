import fs from "fs";
import path from "path";
import {
  LEGACY_CLIENT_NOTICE,
  LEGACY_NOTICE_FIRST_MS,
  LEGACY_NOTICE_INTERVAL_MS,
  LEGACY_NOTICE_MAX,
  LEGACY_NOTICE_USER_GAP_MS,
  isLegacyClient,
  legacyClientNoticeEnabled,
  resetLegacyClientNotices,
  startLegacyClientNotice
} from "../../helpers/LegacyClientNotice";

// A clock that only moves when the test says so.
const fakeClock = () => {
  let time = 1_000_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    clock: {
      now: () => time,
      setTimer: (run: () => void, ms: number) => {
        const id = nextId;
        nextId += 1;
        timers.set(id, { at: time + ms, run });
        return id;
      },
      clearTimer: (id: unknown) => {
        timers.delete(id as number);
      }
    },
    pending: () => timers.size,
    advance: (ms: number) => {
      const end = time + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        time = due[1].at;
        due[1].run();
      }
      time = end;
    }
  };
};

const fakeSocket = () => {
  const sent: Array<{ event: string; payload: { message: string } }> = [];
  return {
    sent,
    socket: {
      connected: true,
      emit: (event: string, payload: { message: string }) => {
        sent.push({ event, payload });
        return true;
      }
    }
  };
};

beforeEach(() => resetLegacyClientNotices());

describe("isLegacyClient", () => {
  it("is a connection that does not say which frontend it runs", () => {
    expect(isLegacyClient({ token: "abc" })).toBe(true);
    expect(isLegacyClient({ token: "abc", r: "1" })).toBe(true);
    expect(isLegacyClient({ token: "abc", fv: "" })).toBe(true);
    expect(isLegacyClient({ token: "abc", fv: "   " })).toBe(true);
    expect(isLegacyClient({ token: "abc", fv: [] })).toBe(true);
    expect(isLegacyClient({ token: "abc", fv: 7 })).toBe(true);
    expect(isLegacyClient({})).toBe(true);
    expect(isLegacyClient(undefined)).toBe(true);
    expect(isLegacyClient(null)).toBe(true);
  });

  it("is not a frontend that identifies itself", () => {
    expect(isLegacyClient({ token: "abc", fv: "main.57238d76.js" })).toBe(
      false
    );
    expect(isLegacyClient({ token: "abc", fv: "dev" })).toBe(false);
    expect(isLegacyClient({ fv: ["main.57238d76.js", "x"] })).toBe(false);
  });
});

describe("legacyClientNoticeEnabled", () => {
  it("is on unless the installation turns it off", () => {
    expect(legacyClientNoticeEnabled(undefined)).toBe(true);
    expect(legacyClientNoticeEnabled("")).toBe(true);
    expect(legacyClientNoticeEnabled("on")).toBe(true);
    expect(legacyClientNoticeEnabled("off")).toBe(false);
    expect(legacyClientNoticeEnabled(" OFF ")).toBe(false);
  });
});

describe("startLegacyClientNotice", () => {
  it("asks for F5 by the socket error channel the old frontend shows as a toast", () => {
    const { clock, advance } = fakeClock();
    const { socket, sent } = fakeSocket();
    startLegacyClientNotice(socket, 7, clock);

    // nothing while the screen settles after the reconnection
    advance(LEGACY_NOTICE_FIRST_MS - 1);
    expect(sent).toEqual([]);

    advance(1);
    expect(sent).toEqual([
      { event: "error", payload: { message: LEGACY_CLIENT_NOTICE } }
    ]);
    expect(LEGACY_CLIENT_NOTICE).toContain("F5");
    // short enough to be read in the three seconds the toast stays on screen
    expect(LEGACY_CLIENT_NOTICE.length).toBeLessThanOrEqual(80);
  });

  it("reminds at intervals and then stops by itself", () => {
    const { clock, advance, pending } = fakeClock();
    const { socket, sent } = fakeSocket();
    startLegacyClientNotice(socket, 7, clock);

    advance(LEGACY_NOTICE_FIRST_MS);
    expect(sent).toHaveLength(1);
    advance(LEGACY_NOTICE_INTERVAL_MS - 1);
    expect(sent).toHaveLength(1);
    advance(1);
    expect(sent).toHaveLength(2);

    advance(LEGACY_NOTICE_INTERVAL_MS * 20);
    expect(sent).toHaveLength(LEGACY_NOTICE_MAX);
    expect(pending()).toBe(0);
  });

  it("stops when the connection ends (the page was loaded again)", () => {
    const { clock, advance, pending } = fakeClock();
    const { socket, sent } = fakeSocket();
    const stop = startLegacyClientNotice(socket, 7, clock);

    advance(LEGACY_NOTICE_FIRST_MS);
    stop();
    expect(pending()).toBe(0);
    advance(LEGACY_NOTICE_INTERVAL_MS * 3);
    expect(sent).toHaveLength(1);
  });

  it("can be stopped before the first notice", () => {
    const { clock, advance } = fakeClock();
    const { socket, sent } = fakeSocket();
    startLegacyClientNotice(socket, 7, clock)();
    advance(LEGACY_NOTICE_INTERVAL_MS);
    expect(sent).toEqual([]);
  });

  it("says nothing to a socket that is no longer connected", () => {
    const { clock, advance, pending } = fakeClock();
    const { socket, sent } = fakeSocket();
    startLegacyClientNotice(socket, 7, clock);
    socket.connected = false;
    advance(LEGACY_NOTICE_INTERVAL_MS * 3);
    expect(sent).toEqual([]);
    expect(pending()).toBe(0);
  });

  it("does not stack notices on two tabs of the same person, and tells both", () => {
    const { clock, advance } = fakeClock();
    const first = fakeSocket();
    const second = fakeSocket();
    startLegacyClientNotice(first.socket, 7, clock);
    advance(1000);
    startLegacyClientNotice(second.socket, 7, clock);

    advance(LEGACY_NOTICE_FIRST_MS);
    expect(first.sent).toHaveLength(1);
    // the second tab waits its turn instead of showing the same toast at once
    expect(second.sent).toHaveLength(0);

    advance(LEGACY_NOTICE_USER_GAP_MS);
    expect(second.sent).toHaveLength(1);
    expect(first.sent).toHaveLength(1);

    // and neither is starved afterwards
    advance(LEGACY_NOTICE_INTERVAL_MS * 2);
    expect(first.sent.length).toBeGreaterThanOrEqual(2);
    expect(second.sent.length).toBeGreaterThanOrEqual(2);
  });

  it("counts the limit per person, whatever the number of tabs", () => {
    const { clock, advance, pending } = fakeClock();
    const first = fakeSocket();
    const second = fakeSocket();
    startLegacyClientNotice(first.socket, 7, clock);
    startLegacyClientNotice(second.socket, 7, clock);

    advance(LEGACY_NOTICE_INTERVAL_MS * 30);
    expect(first.sent.length + second.sent.length).toBe(LEGACY_NOTICE_MAX);
    expect(pending()).toBe(0);
  });

  it("does not repeat at once for a connection that keeps dropping", () => {
    const { clock, advance } = fakeClock();
    const before = fakeSocket();
    const stop = startLegacyClientNotice(before.socket, 7, clock);
    advance(LEGACY_NOTICE_FIRST_MS);
    expect(before.sent).toHaveLength(1);
    stop();

    // reconnects right away
    const after = fakeSocket();
    startLegacyClientNotice(after.socket, 7, clock);
    advance(LEGACY_NOTICE_FIRST_MS);
    expect(after.sent).toHaveLength(0);
    advance(LEGACY_NOTICE_USER_GAP_MS);
    expect(after.sent).toHaveLength(1);
  });

  it("does not become a flood when the connection drops again and again", () => {
    const { clock, advance, pending } = fakeClock();
    let total = 0;
    // the same old page reconnects every two minutes for a whole day
    for (let i = 0; i < 720; i += 1) {
      const { socket, sent } = fakeSocket();
      const stop = startLegacyClientNotice(socket, 7, clock);
      advance(2 * 60 * 1000);
      total += sent.length;
      stop();
    }
    expect(total).toBe(LEGACY_NOTICE_MAX);
    expect(pending()).toBe(0);

    // someone else is still told
    const other = fakeSocket();
    startLegacyClientNotice(other.socket, 8, clock);
    advance(LEGACY_NOTICE_FIRST_MS);
    expect(other.sent).toHaveLength(1);
  });

  it("starts a new round when the server starts again (a new publication)", () => {
    const { clock, advance } = fakeClock();
    const before = fakeSocket();
    startLegacyClientNotice(before.socket, 7, clock);
    advance(LEGACY_NOTICE_INTERVAL_MS * 30);
    expect(before.sent).toHaveLength(LEGACY_NOTICE_MAX);

    resetLegacyClientNotices();
    const after = fakeSocket();
    startLegacyClientNotice(after.socket, 7, clock);
    advance(LEGACY_NOTICE_FIRST_MS);
    expect(after.sent).toHaveLength(1);
  });

  it("never lets a notice that failed to be sent reach the process", () => {
    const { clock, advance, pending } = fakeClock();
    const socket = {
      connected: true,
      emit: () => {
        throw new Error('"error" is a reserved event name');
      }
    };
    startLegacyClientNotice(socket, 7, clock);
    expect(() => advance(LEGACY_NOTICE_INTERVAL_MS * 3)).not.toThrow();
    expect(pending()).toBe(0);
  });

  it("keeps different people independent", () => {
    const { clock, advance } = fakeClock();
    const one = fakeSocket();
    const other = fakeSocket();
    startLegacyClientNotice(one.socket, 7, clock);
    startLegacyClientNotice(other.socket, 8, clock);
    advance(LEGACY_NOTICE_FIRST_MS);
    expect(one.sent).toHaveLength(1);
    expect(other.sent).toHaveLength(1);
  });
});

// The socket server is where it happens: only a connection without `fv` starts
// the reminders, and the disconnection stops them.
describe("socket connection wiring", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../libs/socket.ts"),
    "utf8"
  );

  it("starts the notice only for an old frontend and stops it on disconnect", () => {
    expect(source).toMatch(
      /legacyClientNoticeEnabled\(\) && isLegacyClient\(socket\.handshake\.query\)\s*\?\s*startLegacyClientNotice\(socket, user\.id\)\s*:\s*null/
    );
    expect(source).toMatch(
      /socket\.on\("disconnect", async \(\) => \{\s*stopLegacyNotice\?\.\(\);/
    );
  });
});
