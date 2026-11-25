// Zap Komunick: a conversation whose customer has not picked a sector yet
// (docs/PRD.md, RF-033). The server decides who may see it (the attendants of
// the general queue, backend/src/helpers/GeneralTriage.ts) and only sends it to
// them; the screens just must not throw it away for having no sector.
export const isWaitingForSector = ticket =>
  !!ticket &&
  ticket.queueId == null &&
  !ticket.queue &&
  !!ticket.generalTriageStartedAt &&
  ticket.status === "pending" &&
  ticket.userId == null &&
  !ticket.isGroup;
