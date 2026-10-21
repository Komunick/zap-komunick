// Zap Komunick: SLA rules (docs/PRD.md, RF-002)

export type SlaSituation = "ok" | "breached" | "old";

export interface SlaTicketInput {
  status: string;
  chatbot?: boolean | null;
  // since when the client is waiting for a human reply
  unansweredSince?: Date | string | null;
  // start of the current service cycle of the ticket
  openedAt?: Date | string | null;
}

export interface SlaConfig {
  // maximum time without reply; 0 disables the breach check
  slaMinutes: number;
  // age from which an open ticket is highlighted; 0 disables it
  oldTicketHours: number;
}

export interface SlaResult {
  waiting: boolean;
  waitingMinutes: number | null;
  breached: boolean;
  old: boolean;
  situation: SlaSituation;
}

// reference used by the ZapContábil SLA module ("Aberto há +72h")
export const DEFAULT_OLD_TICKET_HOURS = 72;

const toTime = (value: Date | string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

export function parseSlaConfig(
  slaMinutes: unknown,
  oldTicketHours: unknown
): SlaConfig {
  return {
    slaMinutes: toPositiveInteger(slaMinutes, 0),
    oldTicketHours: toPositiveInteger(oldTicketHours, DEFAULT_OLD_TICKET_HOURS)
  };
}

export function classifySla(
  ticket: SlaTicketInput,
  config: SlaConfig,
  now: Date = new Date()
): SlaResult {
  const notWaiting: SlaResult = {
    waiting: false,
    waitingMinutes: null,
    breached: false,
    old: false,
    situation: "ok"
  };

  if (!["open", "pending"].includes(ticket.status)) {
    return notWaiting;
  }

  const nowTime = now.getTime();
  const since = toTime(ticket.unansweredSince);
  // while the chatbot is handling the conversation nobody owes a reply yet
  const waiting = since !== null && !ticket.chatbot;
  const waitingMs = waiting ? Math.max(0, nowTime - since) : null;

  const breached =
    waiting && config.slaMinutes > 0 && waitingMs > config.slaMinutes * 60000;

  const openedAt = toTime(ticket.openedAt);
  const old =
    openedAt !== null &&
    config.oldTicketHours > 0 &&
    nowTime - openedAt > config.oldTicketHours * 3600000;

  let situation: SlaSituation = "ok";
  if (breached) {
    situation = "breached";
  } else if (old) {
    situation = "old";
  }

  return {
    waiting,
    waitingMinutes: waiting ? Math.floor(waitingMs / 60000) : null,
    breached,
    old,
    situation
  };
}
