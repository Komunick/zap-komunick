// Zap Komunick: tags per sector (docs/PRD.md, RF-019). A tag without sectors
// is for everybody; a tag with sectors only shows to those sectors, so each
// team keeps its own labels.

export interface ScopedTag {
  id: number;
  queueIds?: number[] | null;
}

export interface TagViewer {
  // administrators manage every tag
  isAdmin: boolean;
  // sectors of the user
  queueIds: number[];
  // undefined = general list; null = a ticket without a sector
  ticketQueueId?: number | null;
}

/** Positive integer ids without repeats; null/empty means "all sectors". */
export function normalizeQueueIds(value: unknown): number[] | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Array.isArray(value)) return null;
  const ids = Array.from(
    new Set(value.map(Number).filter(n => Number.isInteger(n) && n > 0))
  );
  return ids.length ? ids : null;
}

export function isTagVisible(tag: ScopedTag, viewer: TagViewer): boolean {
  const sectors = tag.queueIds || [];
  if (!sectors.length) return true;
  if (viewer.ticketQueueId !== undefined) {
    return (
      viewer.ticketQueueId !== null && sectors.includes(viewer.ticketQueueId)
    );
  }
  if (viewer.isAdmin) return true;
  return sectors.some(id => viewer.queueIds.includes(id));
}

/** Requested tag ids that really are tags of this company. */
export function companyTagIds(
  requested: unknown,
  companyIds: number[]
): number[] {
  if (!Array.isArray(requested)) return [];
  const allowed = new Set(companyIds);
  return Array.from(
    new Set(
      requested
        .map(item =>
          typeof item === "object" && item !== null
            ? Number((item as { id?: unknown }).id)
            : Number(item)
        )
        .filter(id => allowed.has(id))
    )
  );
}

/** Add only compatible tags; keep requested history after a sector transfer. */
export function ticketTagIds(
  requested: unknown,
  companyTags: ScopedTag[],
  queueId: number | null,
  existingIds: number[] = []
): number[] {
  const existing = new Set(existingIds);
  const allowed = companyTags.filter(
    tag =>
      existing.has(tag.id) ||
      isTagVisible(tag, {
        isAdmin: false,
        queueIds: [],
        ticketQueueId: queueId
      })
  );
  return companyTagIds(
    requested,
    allowed.map(tag => tag.id)
  );
}
