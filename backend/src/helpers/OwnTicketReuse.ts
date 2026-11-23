// Zap Komunick: starting a conversation with a client whose active ticket is
// already with the same person opens that ticket instead of refusing it
// (docs/PRD.md, RF-028).

export interface ActiveTicketFacts {
  userId: number | null;
  status: string;
  queueId: number | null;
}

export interface OwnTicketRequest {
  userId: number | string;
  queueId?: number | null;
  /** The requester is an administrator (sees every queue). */
  isAdmin: boolean;
  /** Queues of the requester. */
  queueIds: number[];
}

export type OwnTicketStep = { queueId: number } | { status: "open" };

export interface OwnTicketDecision {
  /** The active ticket is the person's and they may open it: reuse it. */
  reuse: boolean;
  /** Updates to run, in order, through UpdateTicketService. */
  steps: OwnTicketStep[];
}

export function decideOwnTicketReuse(
  ticket: ActiveTicketFacts,
  request: OwnTicketRequest
): OwnTicketDecision {
  const own =
    ticket.userId !== null &&
    ticket.userId !== undefined &&
    Number(ticket.userId) === Number(request.userId);
  if (!own) return { reuse: false, steps: [] };

  const steps: OwnTicketStep[] = [];
  const chosenQueue =
    request.queueId === null || request.queueId === undefined
      ? null
      : Number(request.queueId);

  if (ticket.queueId === null || ticket.queueId === undefined) {
    // no sector yet: it goes to the queue the person chose, before being
    // accepted (only admins accept a pending ticket without queue)
    if (chosenQueue === null && !request.isAdmin) {
      return { reuse: false, steps: [] };
    }
    if (chosenQueue !== null) steps.push({ queueId: chosenQueue });
  } else if (
    !request.isAdmin &&
    !request.queueIds.includes(Number(ticket.queueId))
  ) {
    // same rule as ticketContextError: the owner outside the queue cannot
    // open it; the screen says where it is instead
    return { reuse: false, steps: [] };
  }
  // the ticket keeps its sector: no transfer message to the client

  if (ticket.status !== "open") {
    // pending with their name (e.g. client wallet) or paused: start serving
    steps.push({ status: "open" });
  }
  return { reuse: true, steps };
}
