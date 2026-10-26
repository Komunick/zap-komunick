import { Op, WhereOptions } from "sequelize";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

// Zap Komunick: the filter panel of the ticket list (docs/PRD.md, RF-012).
// The filters add to the view (status), the queue chips and the search; they
// never widen what the user can see.

export type WalletFilter = "mine" | "none" | null;

export interface TicketFilters {
  whatsappIds: number[];
  userIds: number[];
  tagIds: number[];
  createdFrom: string | null;
  createdTo: string | null;
  unread: boolean;
  slaBreached: boolean;
  wallet: WalletFilter;
}

export interface TicketFilterQuery {
  whatsappIds?: unknown;
  userIds?: unknown;
  filterTags?: unknown;
  createdFrom?: unknown;
  createdTo?: unknown;
  unread?: unknown;
  slaBreached?: unknown;
  wallet?: unknown;
}

export const MAX_FILTER_ITEMS = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const parseIds = (value: unknown): number[] | null => {
  if (value === undefined || value === null || value === "") return [];
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list) || list.length > MAX_FILTER_ITEMS) return null;
  const ids = list.map(Number);
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) return null;
  return Array.from(new Set(ids));
};

const parseDate = (value: unknown): string | null | false => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE.test(value)) return false;
  return isValid(parseISO(value)) ? value : false;
};

const isTrue = (value: unknown) => value === true || value === "true";

/**
 * Reads the filter parameters of GET /tickets. Returns an error code when a
 * value is malformed, so a typo never turns into "no filter".
 */
export function parseTicketFilters(query: TicketFilterQuery): {
  filters?: TicketFilters;
  error?: string;
} {
  const whatsappIds = parseIds(query.whatsappIds);
  const userIds = parseIds(query.userIds);
  const tagIds = parseIds(query.filterTags);
  if (!whatsappIds || !userIds || !tagIds) {
    return { error: "ERR_FILTER_INVALID_LIST" };
  }

  const createdFrom = parseDate(query.createdFrom);
  const createdTo = parseDate(query.createdTo);
  if (createdFrom === false || createdTo === false) {
    return { error: "ERR_FILTER_INVALID_DATE" };
  }
  if (createdFrom && createdTo && createdFrom > createdTo) {
    return { error: "ERR_FILTER_DATES_REVERSED" };
  }

  let wallet: WalletFilter = null;
  if (query.wallet !== undefined && query.wallet !== "") {
    if (query.wallet !== "mine" && query.wallet !== "none") {
      return { error: "ERR_FILTER_INVALID_WALLET" };
    }
    wallet = query.wallet;
  }

  return {
    filters: {
      whatsappIds,
      userIds,
      tagIds,
      createdFrom,
      createdTo,
      unread: isTrue(query.unread),
      slaBreached: isTrue(query.slaBreached),
      wallet
    }
  };
}

export interface FilterContext {
  userId: number;
  isAdmin: boolean;
  // company setting; 0 means the SLA is off and nothing is breached
  slaMinutes: number;
  now?: Date;
}

/**
 * Conditions to AND with the rest of the ticket query. Filtering by
 * attendant is only for administrators, like the attendant filter of the
 * search. The tags join the "tags" of the search (the ticket or its contact
 * must have every one of them), handled by ListTicketsService.
 */
export function buildTicketFilterWhere(
  filters: TicketFilters,
  context: FilterContext
): WhereOptions[] {
  const where: WhereOptions[] = [];

  if (filters.whatsappIds.length) {
    where.push({ whatsappId: { [Op.in]: filters.whatsappIds } });
  }

  if (filters.userIds.length && context.isAdmin) {
    where.push({ userId: { [Op.in]: filters.userIds } });
  }

  if (filters.createdFrom) {
    where.push({
      createdAt: { [Op.gte]: startOfDay(parseISO(filters.createdFrom)) }
    });
  }
  if (filters.createdTo) {
    where.push({
      createdAt: { [Op.lte]: endOfDay(parseISO(filters.createdTo)) }
    });
  }

  if (filters.unread) {
    where.push({ unreadMessages: { [Op.gt]: 0 } });
  }

  if (filters.slaBreached) {
    if (context.slaMinutes > 0) {
      const now = context.now || new Date();
      where.push({
        status: { [Op.in]: ["open", "pending"] },
        unansweredSince: {
          [Op.lte]: new Date(now.getTime() - context.slaMinutes * 60000)
        },
        chatbot: { [Op.not]: true }
      });
    } else {
      // SLA off: nothing can be breached
      where.push({ id: { [Op.in]: [] } });
    }
  }

  if (filters.wallet === "mine") {
    where.push({ "$contact.walletUserId$": context.userId });
  } else if (filters.wallet === "none") {
    where.push({ "$contact.walletUserId$": null });
  }

  return where;
}

export const hasTicketFilters = (filters: TicketFilters): boolean =>
  filters.whatsappIds.length > 0 ||
  filters.userIds.length > 0 ||
  filters.tagIds.length > 0 ||
  !!filters.createdFrom ||
  !!filters.createdTo ||
  filters.unread ||
  filters.slaBreached ||
  !!filters.wallet;
