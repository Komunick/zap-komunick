import { buildSlaPanel, SlaPanelTicket } from "../../helpers/SlaPanel";

const now = new Date("2026-10-21T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60000);

const fiscal = { id: 1, name: "Fiscal", color: "#f00" };
const dp = { id: 2, name: "DP", color: "#0f0" };
const ana = { id: 10, name: "Ana" };

const tickets: SlaPanelTicket[] = [
  // waiting 90 min, breached
  {
    id: 1,
    status: "pending",
    isGroup: false,
    unansweredSince: minutesAgo(90),
    openedAt: minutesAgo(90),
    queue: fiscal,
    user: null
  },
  // answered, open for 4 days
  {
    id: 2,
    status: "open",
    isGroup: false,
    unansweredSince: null,
    openedAt: minutesAgo(4 * 24 * 60),
    queue: fiscal,
    user: ana
  },
  // waiting 10 min, within the SLA
  {
    id: 3,
    status: "open",
    isGroup: false,
    unansweredSince: minutesAgo(10),
    openedAt: minutesAgo(60),
    queue: dp,
    user: ana
  },
  // group waiting 45 min, breached
  {
    id: 4,
    status: "open",
    isGroup: true,
    unansweredSince: minutesAgo(45),
    openedAt: minutesAgo(50),
    queue: dp,
    user: ana
  },
  // closed tickets never show up
  {
    id: 5,
    status: "closed",
    isGroup: false,
    unansweredSince: minutesAgo(999),
    openedAt: minutesAgo(9999),
    queue: dp,
    user: ana
  }
];

describe("buildSlaPanel", () => {
  const panel = buildSlaPanel(
    tickets,
    { slaMinutes: 30, oldTicketHours: 72 },
    now
  );

  it("counts the totals of the open tickets", () => {
    expect(panel.totals).toEqual({
      total: 4,
      pending: 1,
      open: 3,
      breached: 2,
      old: 1,
      waitingClients: 2,
      groups: 1,
      waitingGroups: 1
    });
  });

  it("groups by queue with the most pressured queue first", () => {
    expect(panel.byQueue).toEqual([
      {
        queueId: 2,
        name: "DP",
        color: "#0f0",
        total: 2,
        waiting: 2,
        breached: 1,
        old: 0
      },
      {
        queueId: 1,
        name: "Fiscal",
        color: "#f00",
        total: 2,
        waiting: 1,
        breached: 1,
        old: 1
      }
    ]);
  });

  it("groups tickets without attendant under no owner", () => {
    const noOwner = panel.byUser.find(entry => entry.userId === null);

    expect(noOwner).toEqual({
      userId: null,
      name: null,
      total: 1,
      waiting: 1,
      breached: 1,
      old: 0
    });
    expect(panel.byUser.find(entry => entry.userId === 10)?.total).toBe(3);
  });

  it("lists breached tickets first, longest wait first", () => {
    expect(panel.tickets.map(row => [row.id, row.situation])).toEqual([
      [1, "breached"],
      [4, "breached"],
      [2, "old"],
      [3, "ok"]
    ]);
  });
});
