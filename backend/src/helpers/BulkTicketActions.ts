// Zap Komunick: actions on many tickets at once (docs/PRD.md, RF-011).
// Each ticket still goes through UpdateTicketService, so permissions, the close
// reason and the realtime events are the same as one by one.

export const BULK_MAX_TICKETS = 100;

export type BulkAction = "accept" | "transfer" | "close";

export interface BulkRequest {
  action: BulkAction;
  ticketIds: number[];
  queueId?: number | null;
  userId?: number | null;
  closeReasonId?: number | null;
  closeReasonNote?: string | null;
}

export interface ParsedBulk {
  error?: string;
  action?: BulkAction;
  ticketIds?: number[];
  data?: Record<string, unknown>;
}

// statuses each action can start from; other tickets are skipped
export const BULK_FROM_STATUSES: Record<BulkAction, string[]> = {
  accept: ["pending"],
  transfer: ["open", "pending", "paused"],
  close: ["open", "pending", "paused"]
};

const positiveInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Validates the body of POST /tickets/bulk and builds the update applied to
 * every ticket. Returns an error code instead when the request is invalid.
 */
export function parseBulkRequest(
  body: Partial<BulkRequest> | undefined,
  reqUserId: number
): ParsedBulk {
  const action = body?.action;
  if (!action || !(action in BULK_FROM_STATUSES)) {
    return { error: "ERR_BULK_INVALID_ACTION" };
  }

  if (!Array.isArray(body.ticketIds) || body.ticketIds.length === 0) {
    return { error: "ERR_BULK_NO_TICKETS" };
  }
  const ids = body.ticketIds.map(positiveInt);
  if (ids.some(id => id === null)) {
    return { error: "ERR_BULK_INVALID_TICKET" };
  }
  const ticketIds = Array.from(new Set(ids as number[]));
  if (ticketIds.length > BULK_MAX_TICKETS) {
    return { error: "ERR_BULK_TOO_MANY" };
  }

  if (action === "accept") {
    return { action, ticketIds, data: { status: "open", userId: reqUserId } };
  }

  if (action === "transfer") {
    const queueId = positiveInt(body.queueId);
    if (!queueId) {
      return { error: "ERR_BULK_NO_QUEUE" };
    }
    const userId = body.userId ? positiveInt(body.userId) : null;
    if (body.userId && !userId) {
      return { error: "ERR_BULK_INVALID_USER" };
    }
    // same rule as the transfer dialog: without a person it goes back to
    // the queue, waiting
    return {
      action,
      ticketIds,
      data: userId
        ? { queueId, userId }
        : { queueId, userId: null, status: "pending" }
    };
  }

  // like closing one by one: the person who closes keeps the ticket, and the
  // rating message is not sent to every client of the batch
  const data: Record<string, unknown> = {
    status: "closed",
    justClose: true,
    userId: reqUserId
  };
  if (body.closeReasonId) {
    const closeReasonId = positiveInt(body.closeReasonId);
    if (!closeReasonId) {
      return { error: "ERR_BULK_INVALID_REASON" };
    }
    data.closeReasonId = closeReasonId;
  }
  if (body.closeReasonNote) {
    data.closeReasonNote = String(body.closeReasonNote).slice(0, 500);
  }
  return { action, ticketIds, data };
}
