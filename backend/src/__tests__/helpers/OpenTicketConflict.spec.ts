import { describeOpenTicket } from "../../helpers/OpenTicketConflict";
import { summarizeHistoryTicket } from "../../helpers/HistoryTickets";

const base = {
  id: 55,
  uuid: "abc-uuid",
  status: "open",
  userId: 7,
  queueId: 3,
  updatedAt: new Date("2026-11-20T13:00:00Z"),
  user: { id: 7, name: "Raiane" },
  queue: { id: 3, name: "Pessoal", color: "#ff0000" },
  whatsapp: { id: 2, name: "WhatsApp JB Fraga", status: "CONNECTED" }
};

const viewer = (isAdmin: boolean, queueIds: number[]) => ({
  companyId: 2,
  isAdmin,
  queueIds
});

describe("describeOpenTicket", () => {
  it("tells who has the ticket, its queue and channel", () => {
    const result = describeOpenTicket(base);
    expect(result.user).toEqual({ id: 7, name: "Raiane" });
    expect(result.queue).toEqual({ id: 3, name: "Pessoal", color: "#ff0000" });
    expect(result.whatsapp).toEqual({
      id: 2,
      name: "WhatsApp JB Fraga",
      connected: true
    });
    expect(result.updatedAt).toBe("2026-11-20T13:00:00.000Z");
  });

  it("leaves permissions unknown without a requester", () => {
    const result = describeOpenTicket(base);
    expect(result.canView).toBeNull();
    expect(result.canTake).toBeNull();
  });

  it("lets an admin open and take a ticket in service with someone else", () => {
    const result = describeOpenTicket(base, {
      userId: 1,
      viewer: viewer(true, [])
    });
    expect(result.canView).toBe(true);
    expect(result.canTake).toBe(true);
  });

  it("lets a queue member see but not take a ticket in service with a colleague", () => {
    const result = describeOpenTicket(base, {
      userId: 9,
      viewer: viewer(false, [3])
    });
    expect(result.canView).toBe(true);
    expect(result.canTake).toBe(false);
  });

  it("lets a queue member take a pending ticket of the queue", () => {
    const result = describeOpenTicket(
      { ...base, status: "pending", userId: null, user: null },
      { userId: 9, viewer: viewer(false, [3]) }
    );
    expect(result.canTake).toBe(true);
    expect(result.user).toBeNull();
  });

  it("keeps a pending ticket of another queue out of reach", () => {
    const result = describeOpenTicket(
      { ...base, status: "pending", userId: null, user: null },
      { userId: 9, viewer: viewer(false, [4]) }
    );
    expect(result.canView).toBe(false);
    expect(result.canTake).toBe(false);
  });

  it("only admins take a pending ticket without queue", () => {
    const pending = {
      ...base,
      status: "pending",
      userId: null,
      user: null,
      queueId: null,
      queue: null
    };
    expect(
      describeOpenTicket(pending, { userId: 9, viewer: viewer(false, [3]) })
        .canTake
    ).toBe(false);
    expect(
      describeOpenTicket(pending, { userId: 1, viewer: viewer(true, []) })
        .canTake
    ).toBe(true);
  });

  it("opens the requester's own ticket in a queue of theirs", () => {
    const result = describeOpenTicket(base, {
      userId: 7,
      viewer: viewer(false, [3])
    });
    expect(result.canView).toBe(true);
    expect(result.canTake).toBe(false);
  });

  it("follows the server rule for the owner outside the queue", () => {
    expect(
      describeOpenTicket(base, { userId: 7, viewer: viewer(false, [4]) })
    ).toMatchObject({ canView: false, canTake: false });
    expect(
      describeOpenTicket(
        { ...base, queueId: null, queue: null },
        { userId: 7, viewer: viewer(false, [3]) }
      )
    ).toMatchObject({ canView: false, canTake: false });
  });

  it("marks a disconnected channel", () => {
    const result = describeOpenTicket({
      ...base,
      whatsapp: { id: 7, name: "JBFraga", status: "DISCONNECTED" }
    });
    expect(result.whatsapp?.connected).toBe(false);
  });
});

describe("summarizeHistoryTicket", () => {
  it("keeps only names, dates and the channel state", () => {
    const result = summarizeHistoryTicket({
      id: 52,
      status: "closed",
      createdAt: "2026-11-12T10:00:00Z",
      updatedAt: "2026-11-13T10:00:00Z",
      queue: { id: 9, name: "JBFraga" },
      whatsapp: { id: 7, name: "JBFraga", status: "DISCONNECTED" },
      user: null
    });
    expect(result).toEqual({
      id: 52,
      status: "closed",
      createdAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-13T10:00:00.000Z",
      queue: { id: 9, name: "JBFraga", color: null },
      whatsapp: { id: 7, name: "JBFraga", connected: false },
      user: null
    });
  });
});
