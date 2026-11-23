import { decideOwnTicketReuse } from "../../helpers/OwnTicketReuse";

const own = { userId: 6, status: "open", queueId: 3 };
const agent = { userId: 6, queueId: 3, isAdmin: false, queueIds: [3, 4] };

describe("decideOwnTicketReuse", () => {
  it("reuses the person's open ticket as it is", () => {
    expect(decideOwnTicketReuse(own, agent)).toEqual({
      reuse: true,
      steps: []
    });
  });

  it("compares ids as numbers (body values may be strings)", () => {
    expect(
      decideOwnTicketReuse(own, {
        ...agent,
        userId: "6",
        queueId: "3" as unknown as number
      })
    ).toEqual({ reuse: true, steps: [] });
  });

  it("starts serving the person's pending or paused ticket", () => {
    for (const status of ["pending", "paused"]) {
      expect(decideOwnTicketReuse({ ...own, status }, agent)).toEqual({
        reuse: true,
        steps: [{ status: "open" }]
      });
    }
  });

  it("keeps the ticket in its sector when another queue of the person is chosen", () => {
    expect(decideOwnTicketReuse(own, { ...agent, queueId: 4 })).toEqual({
      reuse: true,
      steps: []
    });
  });

  it("puts a ticket without sector in the chosen queue before accepting it", () => {
    expect(
      decideOwnTicketReuse(
        { ...own, status: "pending", queueId: null },
        { ...agent, queueId: 4 }
      )
    ).toEqual({ reuse: true, steps: [{ queueId: 4 }, { status: "open" }] });
  });

  it("does not open the person's ticket in a queue they no longer have", () => {
    expect(decideOwnTicketReuse({ ...own, queueId: 9 }, agent).reuse).toBe(
      false
    );
  });

  it("lets an admin open their own ticket in any queue", () => {
    expect(
      decideOwnTicketReuse(
        { ...own, queueId: 9, status: "paused" },
        { ...agent, isAdmin: true, queueIds: [] }
      )
    ).toEqual({ reuse: true, steps: [{ status: "open" }] });
  });

  describe("pending ticket without person and without sector", () => {
    const unclaimed = { userId: null, status: "pending", queueId: null };

    it("goes to the queue the person chose and is accepted by them", () => {
      expect(decideOwnTicketReuse(unclaimed, { ...agent, queueId: 4 })).toEqual(
        { reuse: true, steps: [{ queueId: 4 }, { status: "open" }] }
      );
    });

    it("is not taken into a queue the person does not have", () => {
      expect(
        decideOwnTicketReuse(unclaimed, { ...agent, queueId: 9 }).reuse
      ).toBe(false);
    });

    it("needs a chosen queue unless the person is an admin", () => {
      expect(
        decideOwnTicketReuse(unclaimed, { ...agent, queueId: null }).reuse
      ).toBe(false);
      expect(
        decideOwnTicketReuse(unclaimed, {
          ...agent,
          queueId: null,
          isAdmin: true,
          queueIds: []
        })
      ).toEqual({ reuse: true, steps: [{ status: "open" }] });
    });

    it.each(["open", "paused"])("is not taken when it is %s", status => {
      expect(
        decideOwnTicketReuse({ ...unclaimed, status }, { ...agent, queueId: 4 })
          .reuse
      ).toBe(false);
    });
  });

  it("never reuses a ticket of someone else or without a person", () => {
    expect(decideOwnTicketReuse({ ...own, userId: 7 }, agent).reuse).toBe(
      false
    );
    expect(
      decideOwnTicketReuse({ ...own, userId: null, status: "pending" }, agent)
        .reuse
    ).toBe(false);
  });
});
