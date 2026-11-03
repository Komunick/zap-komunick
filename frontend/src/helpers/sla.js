// Zap Komunick: SLA helpers for the interface (docs/PRD.md, RF-002).
// The rules live in the backend (helpers/SlaRules.ts); this mirrors the
// breach check so the ticket list can highlight tickets in real time.

export function slaWaitingMinutes(ticket, now = Date.now()) {
  if (!ticket?.unansweredSince || ticket.chatbot) {
    return null;
  }
  if (!["open", "pending"].includes(ticket.status)) {
    return null;
  }
  const since = new Date(ticket.unansweredSince).getTime();
  if (Number.isNaN(since)) {
    return null;
  }
  return Math.max(0, Math.floor((now - since) / 60000));
}

export function isSlaBreached(ticket, slaMinutes, now = Date.now()) {
  const limit = Number(slaMinutes) || 0;
  if (limit <= 0 || !ticket?.unansweredSince || ticket.chatbot) {
    return false;
  }
  if (!["open", "pending"].includes(ticket.status)) {
    return false;
  }
  return now - new Date(ticket.unansweredSince).getTime() > limit * 60000;
}

export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) {
    return "-";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}
