import {
  companyTagIds,
  isTagVisible,
  normalizeQueueIds,
  ticketTagIds
} from "../../helpers/TagScope";

describe("normalizeQueueIds", () => {
  it("keeps positive ids without repeats; empty means all sectors", () => {
    expect(normalizeQueueIds([5, "6", 5, -1, "x"])).toEqual([5, 6]);
    expect(normalizeQueueIds([])).toBeNull();
    expect(normalizeQueueIds(null)).toBeNull();
    expect(normalizeQueueIds("5")).toBeNull();
  });
});

describe("isTagVisible", () => {
  const global = { id: 1, queueIds: null };
  const fiscal = { id: 2, queueIds: [5] };
  const dp = { id: 3, queueIds: [6] };

  it("shows global tags to everybody", () => {
    expect(isTagVisible(global, { isAdmin: false, queueIds: [] })).toBe(true);
  });

  it("shows sector tags to the people of the sector", () => {
    const fiscalUser = { isAdmin: false, queueIds: [5] };
    expect(isTagVisible(fiscal, fiscalUser)).toBe(true);
    expect(isTagVisible(dp, fiscalUser)).toBe(false);
  });

  it("shows every tag to administrators", () => {
    expect(isTagVisible(dp, { isAdmin: true, queueIds: [] })).toBe(true);
  });

  it("offers only the tags of the ticket's sector when tagging a ticket", () => {
    const viewer = { isAdmin: true, queueIds: [5, 6], ticketQueueId: 5 };
    expect(
      [global, fiscal, dp].filter(t => isTagVisible(t, viewer)).map(t => t.id)
    ).toEqual([1, 2]);
  });

  it("offers only global tags for a ticket without a sector, even to admins", () => {
    const viewer = { isAdmin: true, queueIds: [5, 6], ticketQueueId: null };
    expect(
      [global, fiscal, dp].filter(t => isTagVisible(t, viewer)).map(t => t.id)
    ).toEqual([1]);
  });
});

describe("companyTagIds", () => {
  it("keeps only tags of the company, from ids or tag objects", () => {
    expect(
      companyTagIds([1, { id: 2 }, 99, "3", { id: 2 }], [1, 2, 3])
    ).toEqual([1, 2, 3]);
    expect(companyTagIds("1", [1])).toEqual([]);
  });
});

describe("ticketTagIds", () => {
  const tags = [
    { id: 1, queueIds: null },
    { id: 2, queueIds: [5] },
    { id: 3, queueIds: [6] },
    { id: 4, queueIds: [5, 6] }
  ];

  it("applies a mixed selection separately to each sector in a batch", () => {
    expect(ticketTagIds([1, 2, 3, 4, 99], tags, 5)).toEqual([1, 2, 4]);
    expect(ticketTagIds([1, 2, 3, 4, 99], tags, 6)).toEqual([1, 3, 4]);
    expect(ticketTagIds([1, 2, 3, 4, 99], tags, null)).toEqual([1]);
  });

  it("returns no eligible additions when all selected tags belong to another sector", () => {
    expect(ticketTagIds([3], tags, 5)).toEqual([]);
  });

  it("retains only requested history from this company after a transfer", () => {
    expect(ticketTagIds([1, 3, 99], tags, 5, [3, 99])).toEqual([1, 3]);
    expect(ticketTagIds([1], tags, 5, [3])).toEqual([1]);
  });
});
