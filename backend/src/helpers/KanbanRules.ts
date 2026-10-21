// Zap Komunick: Kanban rules (docs/PRD.md, RF-004)

// lane of the tickets without a Kanban tag ("Em aberto")
export const OPEN_LANE = 0;

/**
 * Lane of a ticket: the first Kanban tag, in board order, that the ticket
 * has. Tickets without Kanban tags stay in the open lane.
 */
export function laneOf(
  ticketTagIds: number[],
  kanbanTagOrder: number[]
): number {
  return kanbanTagOrder.find(id => ticketTagIds.includes(id)) ?? OPEN_LANE;
}

export interface KanbanMovePlan {
  remove: number[];
  add: number | null;
}

/**
 * Tags to remove and add so the ticket ends up only in the target lane.
 * Tags that are not part of the Kanban are never touched.
 */
export function planKanbanMove(
  currentTagIds: number[],
  kanbanTagIds: number[],
  targetTagId: number
): KanbanMovePlan {
  if (targetTagId !== OPEN_LANE && !kanbanTagIds.includes(targetTagId)) {
    throw new Error("ERR_KANBAN_TAG_NOT_FOUND");
  }

  const remove = currentTagIds.filter(
    id => kanbanTagIds.includes(id) && id !== targetTagId
  );

  const add =
    targetTagId !== OPEN_LANE && !currentTagIds.includes(targetTagId)
      ? targetTagId
      : null;

  return { remove, add };
}
