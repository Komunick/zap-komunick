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

// The queue a ticket counts in for the queue chips of the list: its own, or
// the general one while it waits for the customer to pick a sector. An
// attendant only receives such a ticket as a member of the general queue; an
// administrator receives every ticket, and for them a ticket without a sector
// keeps being shown whatever the chips say, as before.
export const chipQueueId = (ticket, { profile, generalQueueId }) =>
  ticket?.queueId ||
  (profile === "user" && isWaitingForSector(ticket)
    ? Number(generalQueueId) || 0
    : 0);

// True when the chips that are switched on leave the ticket out.
export const outsideSelectedQueues = (ticket, selectedQueueIds, context) => {
  const id = chipQueueId(ticket, context);
  return !!id && (selectedQueueIds || []).indexOf(id) === -1;
};
