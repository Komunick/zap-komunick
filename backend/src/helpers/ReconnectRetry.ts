import { logger } from "../utils/logger";
import { backoffDelay } from "./ReconnectPolicy";

/**
 * Zap Komunick: opens the connection again after `delayMs` and, if the attempt
 * itself fails (database or network unavailable at that moment), tries again
 * with growing delays. Before, one failure left the channel stopped until
 * someone restarted it. `exists` ends the retries of a deleted connection.
 */
export function reconnectWithRetry(
  name: string,
  start: () => Promise<void>,
  exists: () => Promise<boolean>,
  delayMs: number,
  attempt = 0
): void {
  setTimeout(async () => {
    try {
      if (!(await exists())) return;
      await start();
    } catch (error) {
      const nextDelayMs = backoffDelay(attempt + 1);
      logger.error(
        { message: error?.message, attempt, nextDelayMs },
        `Reconnection of ${name} failed, trying again`
      );
      reconnectWithRetry(name, start, exists, nextDelayMs, attempt + 1);
    }
  }, delayMs);
}
