// Zap Komunick: who of the team is online and how busy (docs/PRD.md, RF-013)

import { AccessHours, canAccessNow } from "./AccessHours";

export type OnlineSituation = "online" | "outsideHours" | "offline";

export interface OnlineUserInput {
  id: number;
  name: string;
  profile: string;
  super?: boolean;
  accessHours?: AccessHours | null;
  // has at least one open browser session
  online: boolean;
  // start of the oldest open session
  onlineSince?: Date | string | null;
  // end of the most recent session
  lastSeen?: Date | string | null;
  openCount: number;
  pausedCount: number;
  closedToday: number;
  queues: { id: number; name: string; color: string }[];
}

export interface OnlineUser extends OnlineUserInput {
  situation: OnlineSituation;
  minutesOnline: number | null;
  minutesSinceSeen: number | null;
}

export interface OnlinePanel {
  summary: {
    online: number;
    offline: number;
    outsideHours: number;
    inService: number;
    idle: number;
  };
  users: OnlineUser[];
}

const minutesBetween = (
  from: Date | string | null | undefined,
  now: Date
): number | null => {
  if (!from) return null;
  const time = new Date(from).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 60000));
};

/**
 * Online users outside their access hours are flagged (the login is blocked
 * then, but an open session stays connected). Administrators never are.
 */
export function classifyOnlineUser(
  user: OnlineUserInput,
  now: Date = new Date()
): OnlineUser {
  let situation: OnlineSituation = "offline";
  if (user.online) {
    situation = canAccessNow(user, now) ? "online" : "outsideHours";
  }
  return {
    ...user,
    openCount: Number(user.openCount) || 0,
    pausedCount: Number(user.pausedCount) || 0,
    closedToday: Number(user.closedToday) || 0,
    situation,
    minutesOnline: user.online ? minutesBetween(user.onlineSince, now) : null,
    minutesSinceSeen: user.online ? null : minutesBetween(user.lastSeen, now)
  };
}

const ORDER: Record<OnlineSituation, number> = {
  outsideHours: 0,
  online: 1,
  offline: 2
};

/**
 * Online first (flagged ones on top), the busiest first among them, then the
 * offline ones by who was seen last.
 */
export function buildOnlinePanel(
  users: OnlineUserInput[],
  now: Date = new Date()
): OnlinePanel {
  const list = users.map(user => classifyOnlineUser(user, now));

  list.sort((a, b) => {
    if (ORDER[a.situation] !== ORDER[b.situation]) {
      return ORDER[a.situation] - ORDER[b.situation];
    }
    if (a.situation !== "offline" && a.openCount !== b.openCount) {
      return b.openCount - a.openCount;
    }
    if (a.situation === "offline") {
      const seenA = a.minutesSinceSeen ?? Number.MAX_SAFE_INTEGER;
      const seenB = b.minutesSinceSeen ?? Number.MAX_SAFE_INTEGER;
      if (seenA !== seenB) return seenA - seenB;
    }
    return a.name.localeCompare(b.name);
  });

  const connected = list.filter(u => u.situation !== "offline");
  return {
    summary: {
      online: connected.length,
      offline: list.length - connected.length,
      outsideHours: list.filter(u => u.situation === "outsideHours").length,
      inService: connected.reduce((sum, u) => sum + u.openCount, 0),
      idle: connected.filter(u => u.openCount === 0).length
    },
    users: list
  };
}
