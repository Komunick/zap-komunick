import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Ticket", () => ({ findOne: jest.fn() }));
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({ findAll: jest.fn() }));

// Company 10: the general queue is 7, linked to connection 2.
const GENERAL = 7;
const actor = { userId: 101, companyId: 10 };

const waiting = {
  id: 301,
  companyId: 10,
  contactId: 501,
  queueId: null,
  isGroup: false,
  status: "pending",
  channel: "whatsapp",
  userId: null,
  whatsappId: 2,
  generalTriageStartedAt: new Date("2026-11-25T14:11:00Z")
};

const as = (profile: string, queueIds: number[]) =>
  (User.findOne as jest.Mock).mockResolvedValue({
    id: actor.userId,
    companyId: 10,
    profile,
    queues: queueIds.map(id => ({ id, companyId: 10 }))
  });

const ticket = (change: Record<string, unknown> = {}) =>
  (Ticket.findOne as jest.Mock).mockResolvedValue({ ...waiting, ...change });

beforeEach(() => {
  jest.clearAllMocks();
  (Contact.findOne as jest.Mock).mockResolvedValue({ id: 501, companyId: 10 });
  (Setting.findAll as jest.Mock).mockResolvedValue([
    { value: String(GENERAL) }
  ]);
  (Whatsapp.findAll as jest.Mock).mockResolvedValue([{ id: 2 }]);
});

describe("a conversation waiting for the customer to pick a sector", () => {
  it("is open to an attendant of the general queue", async () => {
    as("user", [GENERAL, 8]);
    ticket();
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).resolves.toMatchObject({ ticket: { id: 301 } });
  });

  it("stays closed to an attendant who is not of the general queue", async () => {
    as("user", [8, 9]);
    ticket();
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ message: "ERR_NO_PERMISSION", statusCode: 403 });
  });

  it("stays closed to an attendant without any sector", async () => {
    as("user", []);
    ticket();
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([
    [
      "never entered the wait (started from the phone)",
      {
        generalTriageStartedAt: null
      }
    ],
    ["was taken by an administrator", { userId: 55, status: "open" }],
    ["is of a connection outside the general queue", { whatsappId: 9 }],
    ["is a group", { isGroup: true }],
    ["is closed", { status: "closed" }]
  ])(
    "does not open a conversation without sector that %s",
    async (_reason, change) => {
      as("user", [GENERAL]);
      ticket(change);
      await expect(
        AuthorizeTicketContextService(301, actor)
      ).rejects.toMatchObject({ statusCode: 403 });
    }
  );

  it("does not open anything when the company has no general triage", async () => {
    as("user", [GENERAL]);
    ticket();
    (Setting.findAll as jest.Mock).mockResolvedValue([]);
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("never crosses companies", async () => {
    as("user", [GENERAL]);
    ticket();
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 501,
      companyId: 11
    });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ message: "ERR_NO_TICKET_FOUND" });
  });

  it("still checks the contact the caller expects", async () => {
    as("user", [GENERAL]);
    ticket();
    await expect(
      AuthorizeTicketContextService(301, actor, 999)
    ).rejects.toMatchObject({ message: "ERR_NO_TICKET_FOUND" });
  });
});

describe("what does not change", () => {
  it("keeps every ticket without a sector open to an administrator, with no extra lookup", async () => {
    as("admin", []);
    ticket({ generalTriageStartedAt: null });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).resolves.toMatchObject({ ticket: { id: 301 } });
    expect(Setting.findAll).not.toHaveBeenCalled();
  });

  it("decides a ticket that has a sector by the sector alone, with no extra lookup", async () => {
    as("user", [8]);
    ticket({ queueId: 8, generalTriageStartedAt: null });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).resolves.toMatchObject({ ticket: { id: 301 } });

    ticket({ queueId: 9, generalTriageStartedAt: null });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Setting.findAll).not.toHaveBeenCalled();
    expect(Whatsapp.findAll).not.toHaveBeenCalled();
  });

  it("does not look anything up for a ticket without sector that is not waiting", async () => {
    as("user", [GENERAL]);
    ticket({ generalTriageStartedAt: null });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Setting.findAll).not.toHaveBeenCalled();
  });

  it("reads what the rule needs only for a ticket without sector, and leaves the first read as it was", async () => {
    as("user", [GENERAL]);
    ticket();
    await AuthorizeTicketContextService(301, actor);
    const reads = (Ticket.findOne as jest.Mock).mock.calls.map(
      ([options]) => options
    );
    expect(reads).toHaveLength(2);
    expect(reads[0].attributes).toEqual([
      "id",
      "companyId",
      "contactId",
      "queueId",
      "isGroup"
    ]);
    expect(reads[1].where).toEqual({ id: 301, companyId: 10 });
    expect(reads[1].attributes).toEqual(
      expect.arrayContaining([
        "queueId",
        "status",
        "channel",
        "isGroup",
        "userId",
        "whatsappId",
        "generalTriageStartedAt"
      ])
    );

    // a ticket that has a sector is read once, as before
    (Ticket.findOne as jest.Mock).mockClear();
    ticket({ queueId: GENERAL, generalTriageStartedAt: null });
    await AuthorizeTicketContextService(301, actor);
    expect(Ticket.findOne).toHaveBeenCalledTimes(1);

    // and so is any ticket for an administrator
    (Ticket.findOne as jest.Mock).mockClear();
    as("admin", []);
    ticket();
    await AuthorizeTicketContextService(301, actor);
    expect(Ticket.findOne).toHaveBeenCalledTimes(1);
  });

  it("uses the state read at that moment, not the first read", async () => {
    as("user", [GENERAL]);
    // between the two reads the customer picked a sector the viewer is not in
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce({ ...waiting })
      .mockResolvedValueOnce({ ...waiting, queueId: 9 });
    await expect(
      AuthorizeTicketContextService(301, actor)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
