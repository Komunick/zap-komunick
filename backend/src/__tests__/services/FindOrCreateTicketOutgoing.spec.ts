import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import { resolveWalletAssignment } from "../../helpers/WalletRules";
import FindOrCreateTicketService from "../../services/TicketServices/FindOrCreateTicketService";

// A message sent from the company number (another app on the same number, or
// the phone) to a client with no active ticket must not open a pending ticket
// without sector: nobody but admins could see it, and it blocked "New ticket"
// for that client.
jest.mock("../../database", () => ({
  __esModule: true,
  default: { transaction: (callback: () => Promise<unknown>) => callback() }
}));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock(
  "../../services/TicketServices/FindOrCreateATicketTrakingService",
  () => jest.fn()
);
jest.mock("../../services/CounterServices/IncrementCounter", () => ({
  incrementCounter: jest.fn()
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../helpers/WalletRules", () => ({
  resolveWalletAssignment: jest.fn()
}));

const findOne = Ticket.findOne as jest.Mock;
const create = Ticket.create as jest.Mock;
const show = ShowTicketService as jest.Mock;
const traking = FindOrCreateATicketTrakingService as jest.Mock;
const setting = GetCompanySetting as jest.Mock;
const wallet = resolveWalletAssignment as jest.Mock;

const contact = { id: 77, companyId: 2, walletUserId: null } as Contact;
const queue = { id: 3 } as Queue;

beforeEach(() => {
  jest.clearAllMocks();
  setting.mockResolvedValue("0");
  wallet.mockReturnValue(null);
  show.mockImplementation(async id => ({ id }));
  create.mockImplementation(async data => ({ id: 900, ...data }));
});

describe("outgoing message to a client without an active ticket", () => {
  it("goes to the client's latest ticket without reopening it", async () => {
    const latest = { id: 481, status: "closed", update: jest.fn() };
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(latest);

    const result = await FindOrCreateTicketService(contact, 2, 2, {
      outgoing: true
    });

    expect(result).toEqual({
      ticket: { id: 481 },
      justCreated: false,
      queueRepaired: false,
      startInboundQueue: false
    });
    expect(latest.update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(traking).not.toHaveBeenCalled();
  });

  it("creates a closed ticket for its history when the client has none", async () => {
    findOne.mockResolvedValue(null);

    const result = await FindOrCreateTicketService(contact, 2, 2, {
      outgoing: true
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 77,
        status: "closed",
        queueId: null,
        userId: null,
        unreadMessages: 0
      })
    );
    expect(result.ticket).toEqual({ id: 900 });
    expect(result.justCreated).toBe(false);
    expect(traking).not.toHaveBeenCalled();
  });

  it("keeps using the active ticket when there is one", async () => {
    const active = { id: 55, status: "open", queueId: 3, userId: 14 };
    findOne.mockResolvedValueOnce(active);

    const result = await FindOrCreateTicketService(contact, 2, 2, {
      outgoing: true
    });

    expect(result.ticket).toEqual({ id: 55 });
    expect(create).not.toHaveBeenCalled();
  });

  it("still opens a pending ticket when the channel gives it a queue", async () => {
    findOne.mockResolvedValue(null);

    await FindOrCreateTicketService(contact, 2, 2, { outgoing: true, queue });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", queueId: 3 })
    );
  });

  it("still opens a pending ticket for the wallet owner", async () => {
    findOne.mockResolvedValue(null);
    setting.mockImplementation(async (_company, key) =>
      key === "walletAutoAssign" ? "enabled" : "0"
    );
    wallet.mockReturnValue({ userId: 21, queueId: 2 });

    await FindOrCreateTicketService(
      { ...contact, walletUserId: 21 } as Contact,
      2,
      2,
      { outgoing: true }
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", userId: 21, queueId: 2 })
    );
  });

  it("does not change messages received from the client", async () => {
    findOne.mockResolvedValue(null);

    await FindOrCreateTicketService(contact, 2, 2, { incrementUnread: true });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", unreadMessages: 1 })
    );
  });
});
