import { laneOf, planKanbanMove, OPEN_LANE } from "../../helpers/KanbanRules";

describe("laneOf", () => {
  const board = [10, 20, 30];

  it("puts tickets without Kanban tags in the open lane", () => {
    expect(laneOf([1, 2], board)).toBe(OPEN_LANE);
    expect(laneOf([], board)).toBe(OPEN_LANE);
  });

  it("uses the Kanban tag of the ticket", () => {
    expect(laneOf([1, 20], board)).toBe(20);
  });

  it("uses the first lane in board order when the ticket has two Kanban tags", () => {
    expect(laneOf([30, 10], board)).toBe(10);
  });
});

describe("planKanbanMove", () => {
  const kanbanTags = [10, 20, 30];

  it("replaces the current Kanban tag by the target one", () => {
    expect(planKanbanMove([1, 10], kanbanTags, 20)).toEqual({
      remove: [10],
      add: 20
    });
  });

  it("keeps tags that are not part of the Kanban", () => {
    const plan = planKanbanMove([1, 2, 10], kanbanTags, 30);

    expect(plan.remove).toEqual([10]);
    expect(plan.remove).not.toContain(1);
    expect(plan.remove).not.toContain(2);
  });

  it("removes every Kanban tag when moving to the open lane", () => {
    expect(planKanbanMove([10, 30, 5], kanbanTags, OPEN_LANE)).toEqual({
      remove: [10, 30],
      add: null
    });
  });

  it("does nothing when the ticket is already in the target lane", () => {
    expect(planKanbanMove([20], kanbanTags, 20)).toEqual({
      remove: [],
      add: null
    });
  });

  it("cleans a duplicated Kanban tag when moving to one of them", () => {
    expect(planKanbanMove([10, 20], kanbanTags, 20)).toEqual({
      remove: [10],
      add: null
    });
  });

  it("refuses a tag that is not a Kanban lane", () => {
    expect(() => planKanbanMove([10], kanbanTags, 99)).toThrow(
      "ERR_KANBAN_TAG_NOT_FOUND"
    );
  });
});
