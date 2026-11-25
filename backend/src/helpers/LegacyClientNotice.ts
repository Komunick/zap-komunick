// Zap Komunick: tells the browsers that are still running an OLD frontend to
// load the page again (docs/PRD.md, RF-032).
//
// Whoever keeps the SuperChat open all day keeps running the JavaScript loaded
// in the morning. From this delivery on, the frontend notices a publication by
// itself and shows "Atualizar" (frontend/src/helpers/appVersion.js), and says
// so when it connects: `fv` (frontend version) in the socket handshake.
//
// A frontend from before this delivery says nothing and cannot learn anything
// new: it only runs the code it already has. The one thing it already does with
// a message from the server is to show the text of a socket `error` event as a
// toast (the channel of the WhatsApp connection warnings, since 04/11/2026). So
// the server uses exactly that: a connection WITHOUT `fv` gets a short notice
// asking for F5, a few times, until the page is loaded again.
//
// The notice never logs anyone out and never reloads the page by itself: what
// is being typed stays where it is, and the person chooses the moment.

export const LEGACY_CLIENT_NOTICE =
  "O SuperChat foi atualizado. Aperte F5 para carregar a versão nova.";

// The first notice waits for the screen to settle after the reconnection; the
// others come at a pace that reminds without getting in the way of the work.
export const LEGACY_NOTICE_FIRST_MS = 10 * 1000;
export const LEGACY_NOTICE_INTERVAL_MS = 10 * 60 * 1000;
// The limit is PER PERSON, whatever the number of tabs and of reconnections: a
// connection that keeps dropping must not turn the notice into a flood. The
// count lives in memory, so a new publication (the backend starts again)
// begins a new round, which is exactly when a new round is wanted.
export const LEGACY_NOTICE_MAX = 6;
// Two tabs of the same person, or a connection that keeps dropping, do not
// stack notices: the same person hears it at most once in this interval.
export const LEGACY_NOTICE_USER_GAP_MS = 60 * 1000;

// `LEGACY_CLIENT_NOTICE=off` turns the notice off for an installation.
export const legacyClientNoticeEnabled = (
  value: string | undefined = process.env.LEGACY_CLIENT_NOTICE
): boolean =>
  String(value ?? "")
    .trim()
    .toLowerCase() !== "off";

type HandshakeQuery = Record<string, unknown> | undefined | null;

// A frontend that knows how to notice a publication identifies itself.
export const isLegacyClient = (query: HandshakeQuery): boolean => {
  const version = query?.fv;
  const text = Array.isArray(version) ? version[0] : version;
  return !(typeof text === "string" && text.trim() !== "");
};

type NoticeSocket = {
  connected?: boolean;
  emit: (event: string, payload: { message: string }) => unknown;
};

type NoticeClock = {
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

const systemClock: NoticeClock = {
  now: () => Date.now(),
  setTimer: (callback, ms) => {
    const timer = setTimeout(callback, ms);
    // A pending reminder must never keep the process alive on shutdown.
    timer.unref?.();
    return timer;
  },
  clearTimer: timer => clearTimeout(timer as NodeJS.Timeout)
};

const noticesByUser = new Map<number, { last: number; count: number }>();

export const resetLegacyClientNotices = (): void => noticesByUser.clear();

// Starts the reminders for one connection of an old frontend and returns the
// function that stops them (call it when the socket disconnects).
export const startLegacyClientNotice = (
  socket: NoticeSocket,
  userId: number,
  clock: NoticeClock = systemClock
): (() => void) => {
  let stopped = false;
  let timer: unknown = null;

  const schedule = (ms: number) => {
    timer = clock.setTimer(tick, ms);
  };

  function tick() {
    timer = null;
    if (stopped || socket.connected === false) return;
    const now = clock.now();
    const told = noticesByUser.get(userId);
    if (told && told.count >= LEGACY_NOTICE_MAX) return;
    if (told && now - told.last < LEGACY_NOTICE_USER_GAP_MS) {
      // Another tab of this person was just told: this one waits its turn.
      schedule(LEGACY_NOTICE_USER_GAP_MS - (now - told.last));
      return;
    }
    const count = (told?.count ?? 0) + 1;
    noticesByUser.set(userId, { last: now, count });
    try {
      socket.emit("error", { message: LEGACY_CLIENT_NOTICE });
    } catch {
      // A notice that could not be sent must never take the server down (an
      // exception inside a timer has nobody to catch it): it is just dropped.
      return;
    }
    if (count < LEGACY_NOTICE_MAX) schedule(LEGACY_NOTICE_INTERVAL_MS);
  }

  schedule(LEGACY_NOTICE_FIRST_MS);

  return () => {
    stopped = true;
    if (timer !== null) clock.clearTimer(timer);
    timer = null;
  };
};
