// Zap Komunick: pause and close reason rules (docs/PRD.md, RF-007)

// statuses in which a ticket is still being handled; a paused ticket keeps
// receiving the client's messages instead of a new ticket being opened
export const ACTIVE_TICKET_STATUSES = ["open", "pending", "paused"];

/**
 * Only a ticket in service (open) can be paused. Returns an error code or
 * null when the transition is allowed.
 */
export function checkStatusTransition(
  currentStatus: string,
  targetStatus?: string
): string | null {
  if (
    targetStatus === "paused" &&
    currentStatus !== "open" &&
    currentStatus !== "paused"
  ) {
    return "ERR_TICKET_PAUSE_NOT_OPEN";
  }
  return null;
}

export interface CloseReasonCheck {
  // company setting "closeReasonRequired"
  required: boolean;
  // closed by an attendant (not by a timeout or another automation)
  userInitiated: boolean;
  isGroup: boolean;
  closeReasonId?: number | null;
  activeReasonIds: number[];
}

/**
 * Validates the reason sent when a ticket is closed. A given reason must be an
 * active reason of the company; it is mandatory only when the company asks for
 * it and an attendant closes a ticket that is not a group.
 */
export function checkCloseReason(input: CloseReasonCheck): string | null {
  if (input.closeReasonId) {
    return input.activeReasonIds.includes(input.closeReasonId)
      ? null
      : "ERR_CLOSE_REASON_NOT_FOUND";
  }

  if (input.required && input.userInitiated && !input.isGroup) {
    return "ERR_CLOSE_REASON_REQUIRED";
  }

  return null;
}
