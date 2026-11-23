// Order and numbering of the queues in the bot menu of a channel.
// The administrator saves the order in the channel screen; it is kept in
// WhatsappQueues.position. The menu numbers the queues 1..n in that order and
// the customer's reply is read with the same numbering.

type MenuQueue = {
  id: number;
  name: string;
  WhatsappQueue?: { position?: number | null } | null;
};

const positionOf = (queue: MenuQueue): number | null => {
  const position = queue.WhatsappQueue?.position;
  return Number.isInteger(position) ? position : null;
};

// Saved position first; links without a position go last, keeping the order
// they came in (alphabetical, from the query).
export const sortWhatsappQueues = <T extends MenuQueue>(queues: T[]): T[] =>
  queues
    .map((queue, index) => ({ queue, index, position: positionOf(queue) }))
    .sort((a, b) => {
      if (a.position !== b.position) {
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position;
      }
      return a.index - b.index;
    })
    .map(({ queue }) => queue);

export const GENERAL_QUEUE_KEYWORD = "geral";

// Queue picked by the customer's reply to the menu: the option number, or the
// word "geral" when the channel has the general triage queue.
export const pickMenuQueue = <T extends MenuQueue>(
  queues: T[],
  reply: string | null | undefined,
  generalQueue?: T | null
): T | null => {
  const answer = typeof reply === "string" ? reply.trim() : "";
  if (!answer) return null;

  if (generalQueue && answer.toLowerCase() === GENERAL_QUEUE_KEYWORD) {
    return generalQueue;
  }

  if (!/^\d{1,3}$/.test(answer)) return null;
  return queues[Number(answer) - 1] ?? null;
};

// Menu lines in the saved order: "*[ 1 ]* - Legalização".
export const formatQueueMenu = (
  queues: MenuQueue[],
  numberLabel: (number: number) => string = number => `*[ ${number} ]*`
): string =>
  queues
    .map((queue, index) => `${numberLabel(index + 1)} - ${queue.name}\n`)
    .join("");

// Positions to save for the queue ids sent by the channel screen, in order.
export const queuePositions = (
  queueIds: Array<number | string>
): Array<{ queueId: number; position: number }> => {
  const seen = new Set<number>();
  return queueIds
    .map(Number)
    .filter(id => {
      if (!Number.isSafeInteger(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((queueId, index) => ({ queueId, position: index + 1 }));
};
