// Zap Komunick: what to do when the WhatsApp socket closes (docs/TAD.md,
// "Reconexão do WhatsApp"). Status codes of libzapitu-rf/Baileys
// DisconnectReason.

export const CLOSE_REASONS: Record<number, string> = {
  401: "loggedOut",
  403: "forbidden",
  408: "connectionLost",
  411: "multideviceMismatch",
  428: "connectionClosed",
  440: "connectionReplaced",
  500: "badSession",
  503: "unavailableService",
  515: "restartRequired"
};

export type ReconnectDecision =
  // the session is gone: clear the credentials, a new QR code is needed
  | { action: "logout"; reason: string }
  // another client took this session: stop, do not fight over it
  | { action: "stop"; reason: string }
  // a network hiccup: connect again with the same credentials after a while
  | { action: "reconnect"; reason: string; delayMs: number };

export const BASE_DELAY_MS = 2000;
export const MAX_DELAY_MS = 5 * 60 * 1000;

/**
 * Delay of the n-th reconnection in a row (n starts at 0): 2 s, 4 s, 8 s ...
 * up to 5 min, with up to 20% of jitter so many sessions do not retry
 * together after an outage.
 */
export function backoffDelay(attempt: number, random = Math.random): number {
  const exponential = Math.min(
    MAX_DELAY_MS,
    BASE_DELAY_MS * 2 ** Math.max(0, attempt)
  );
  return Math.round(exponential * (1 + 0.2 * random()));
}

export function decideReconnect(
  statusCode: number | undefined,
  attempt: number,
  random = Math.random
): ReconnectDecision {
  const reason = CLOSE_REASONS[statusCode] || `unknown(${statusCode ?? "-"})`;

  switch (statusCode) {
    case 401: // logged out on the phone
    case 403: // blocked by WhatsApp
    case 411: // the phone needs a new pairing
    case 500: // credentials no longer valid
      return { action: "logout", reason };
    case 440:
      return { action: "stop", reason };
    case 515:
      // expected right after pairing: reconnect at once
      return { action: "reconnect", reason, delayMs: 500 };
    default:
      return {
        action: "reconnect",
        reason,
        delayMs: backoffDelay(attempt, random)
      };
  }
}
