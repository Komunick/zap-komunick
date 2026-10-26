import { Op } from "sequelize";
import {
  buildTicketFilterWhere,
  hasTicketFilters,
  MAX_FILTER_ITEMS,
  parseTicketFilters
} from "../../helpers/TicketFilters";

const empty = parseTicketFilters({}).filters;

describe("parseTicketFilters", () => {
  it("starts without any filter", () => {
    expect(empty).toEqual({
      whatsappIds: [],
      userIds: [],
      tagIds: [],
      createdFrom: null,
      createdTo: null,
      unread: false,
      slaBreached: false,
      wallet: null
    });
    expect(hasTicketFilters(empty)).toBe(false);
  });

  it("reads lists as JSON text or arrays, without repeats", () => {
    const { filters } = parseTicketFilters({
      whatsappIds: "[1,2,2]",
      userIds: [3],
      filterTags: "[4]"
    });
    expect(filters.whatsappIds).toEqual([1, 2]);
    expect(filters.userIds).toEqual([3]);
    expect(filters.tagIds).toEqual([4]);
    expect(hasTicketFilters(filters)).toBe(true);
  });

  it("refuses malformed or oversized lists", () => {
    expect(parseTicketFilters({ whatsappIds: "[1," }).error).toBe(
      "ERR_FILTER_INVALID_LIST"
    );
    expect(parseTicketFilters({ userIds: "[0]" }).error).toBe(
      "ERR_FILTER_INVALID_LIST"
    );
    const many = JSON.stringify(
      Array.from({ length: MAX_FILTER_ITEMS + 1 }, (_, i) => i + 1)
    );
    expect(parseTicketFilters({ filterTags: many }).error).toBe(
      "ERR_FILTER_INVALID_LIST"
    );
  });

  it("checks the dates of the period", () => {
    expect(parseTicketFilters({ createdFrom: "26/10/2026" }).error).toBe(
      "ERR_FILTER_INVALID_DATE"
    );
    expect(parseTicketFilters({ createdTo: "2026-02-30" }).error).toBe(
      "ERR_FILTER_INVALID_DATE"
    );
    expect(
      parseTicketFilters({ createdFrom: "2026-10-26", createdTo: "2026-10-01" })
        .error
    ).toBe("ERR_FILTER_DATES_REVERSED");
    expect(
      parseTicketFilters({ createdFrom: "2026-10-01", createdTo: "2026-10-26" })
        .filters.createdTo
    ).toBe("2026-10-26");
  });

  it("reads the switches and the wallet", () => {
    const { filters } = parseTicketFilters({
      unread: "true",
      slaBreached: "false",
      wallet: "mine"
    });
    expect(filters.unread).toBe(true);
    expect(filters.slaBreached).toBe(false);
    expect(filters.wallet).toBe("mine");
    expect(parseTicketFilters({ wallet: "all" }).error).toBe(
      "ERR_FILTER_INVALID_WALLET"
    );
  });
});

describe("buildTicketFilterWhere", () => {
  const context = { userId: 7, isAdmin: true, slaMinutes: 30 };

  it("adds nothing without filters", () => {
    expect(buildTicketFilterWhere(empty, context)).toEqual([]);
  });

  it("filters by connection and, for admins, by attendant", () => {
    const filters = { ...empty, whatsappIds: [1], userIds: [5] };
    expect(buildTicketFilterWhere(filters, context)).toEqual([
      { whatsappId: { [Op.in]: [1] } },
      { userId: { [Op.in]: [5] } }
    ]);
    expect(
      buildTicketFilterWhere(filters, { ...context, isAdmin: false })
    ).toEqual([{ whatsappId: { [Op.in]: [1] } }]);
  });

  it("limits the period from the start of the first day to the end of the last", () => {
    const [from, to] = buildTicketFilterWhere(
      { ...empty, createdFrom: "2026-10-01", createdTo: "2026-10-26" },
      context
    ) as { createdAt: Record<symbol, Date> }[];
    expect(from.createdAt[Op.gte].getHours()).toBe(0);
    expect(to.createdAt[Op.lte].getHours()).toBe(23);
    expect(to.createdAt[Op.lte].getDate()).toBe(26);
  });

  it("finds the breached SLA from the company deadline", () => {
    const now = new Date("2026-10-26T15:00:00");
    const [clause] = buildTicketFilterWhere(
      { ...empty, slaBreached: true },
      { ...context, now }
    ) as Record<string, Record<symbol, unknown>>[];
    expect(clause.status[Op.in]).toEqual(["open", "pending"]);
    expect(clause.unansweredSince[Op.lte]).toEqual(
      new Date("2026-10-26T14:30:00")
    );
  });

  it("finds nothing breached when the SLA is off", () => {
    expect(
      buildTicketFilterWhere(
        { ...empty, slaBreached: true },
        { ...context, slaMinutes: 0 }
      )
    ).toEqual([{ id: { [Op.in]: [] } }]);
  });

  it("filters the wallet of the user or the contacts without owner", () => {
    expect(
      buildTicketFilterWhere({ ...empty, wallet: "mine" }, context)
    ).toEqual([{ "$contact.walletUserId$": 7 }]);
    expect(
      buildTicketFilterWhere({ ...empty, wallet: "none" }, context)
    ).toEqual([{ "$contact.walletUserId$": null }]);
  });

  it("keeps only tickets with unread messages", () => {
    expect(buildTicketFilterWhere({ ...empty, unread: true }, context)).toEqual(
      [{ unreadMessages: { [Op.gt]: 0 } }]
    );
  });
});
