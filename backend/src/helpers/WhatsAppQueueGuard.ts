import { logger } from "../utils/logger";

// Zap Komunick: the WhatsApp library processes messages, receipts and
// notifications in a single queue without timeouts. If one item never ends,
// nothing else comes in while the connection still looks open ("WhatsApp
// mudo", docs/TAD.md). Closing the socket and opening it again with the same
// credentials gives a new queue, and WhatsApp delivers again what was not
// acknowledged.

export const QUEUE_STALL_MS = 2 * 60 * 1000;
export const MAX_QUEUE_STALL_MS = 10 * 60 * 1000;
const STALL_MEMORY_MS = 60 * 60 * 1000;

const recentStalls = new Map<number, { count: number; last: number }>();

type Queue = { mutex: <T>(code: () => Promise<T> | T) => Promise<T> };

/**
 * How long an item may take. It doubles after each recent stall, so an item
 * that always stalls does not make the connection restart every 2 minutes.
 */
export function queueStallLimit(id: number, now = Date.now()): number {
  const stall = recentStalls.get(id);
  if (!stall || now - stall.last > STALL_MEMORY_MS) return QUEUE_STALL_MS;
  return Math.min(MAX_QUEUE_STALL_MS, QUEUE_STALL_MS * 2 ** stall.count);
}

export function registerQueueStall(id: number, now = Date.now()): void {
  const stall = recentStalls.get(id);
  const count =
    stall && now - stall.last <= STALL_MEMORY_MS ? stall.count + 1 : 1;
  recentStalls.set(id, { count, last: now });
}

export function forgetQueueStalls(id: number): void {
  recentStalls.delete(id);
}

/**
 * Watches the time of each item of the queue. When an item exceeds `limitMs`,
 * `onStall` is called once and the items still waiting never run: they belong
 * to the old socket, and decrypting them there would spend the keys without
 * delivering the message.
 */
export function guardQueue(
  queue: Queue,
  limitMs: number,
  onStall: () => void
): void {
  const original = queue.mutex.bind(queue) as Queue["mutex"];
  let stalled = false;

  queue.mutex = <T>(code: () => Promise<T> | T): Promise<T> =>
    original<T>(async () => {
      if (stalled) return new Promise<T>(() => undefined);

      const timer = setTimeout(() => {
        stalled = true;
        try {
          onStall();
        } catch (error) {
          logger.error({ error }, "guardQueue: error recovering the queue");
        }
      }, limitMs);
      timer.unref?.();

      try {
        return await code();
      } finally {
        clearTimeout(timer);
      }
    });
}
