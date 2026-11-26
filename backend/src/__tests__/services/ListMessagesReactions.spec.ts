import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ListMessagesService from "../../services/MessageServices/ListMessagesService";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import { GetCompanySetting } from "../../helpers/CheckSettings";

jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0)
}));
jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../services/TicketServices/ShowTicketService", () =>
  jest.fn(async () => ({ id: 301, contactId: 77, companyId: 10 }))
);
jest.mock("../../services/TicketServices/AuthorizeTicketContextService", () =>
  jest.fn()
);
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));

const findAll = Message.findAll as jest.Mock;
const authorize = AuthorizeTicketContextService as jest.Mock;
const setting = GetCompanySetting as jest.Mock;

// Walks a Sequelize where tree, including Op symbol keys, looking for a
// column name or a value.
const mentions = (node: unknown, value: string): boolean => {
  if (node === value) return true;
  if (!node || typeof node !== "object") return false;
  return [...Object.keys(node), ...Object.getOwnPropertySymbols(node)].some(
    key =>
      key === value ||
      mentions((node as Record<string | symbol, unknown>)[key], value)
  );
};

const lastQuery = () => findAll.mock.calls[findAll.mock.calls.length - 1][0];
const include = (alias: string) =>
  lastQuery().include.find((item: { as?: string }) => item.as === alias);

beforeEach(() => {
  jest.clearAllMocks();
  (Ticket.findAll as jest.Mock).mockResolvedValue([
    { id: 301, queueId: 20 },
    { id: 200, queueId: 99 }
  ]);
  findAll.mockResolvedValue([]);
});

describe.each([
  ["an admin", true, "message"],
  ["an agent restricted to the queue history", false, "message"]
])("listing a conversation for %s", (_label, isAdmin, visibility) => {
  beforeEach(() => {
    authorize.mockResolvedValue({ viewer: { isAdmin, queueIds: [20] } });
    setting.mockResolvedValue(visibility);
  });

  it("keeps reactions out of the rows but loads them as replies", async () => {
    await ListMessagesService({
      ticketId: "301",
      companyId: 10,
      userId: 5
    });

    expect(mentions(lastQuery().where, "reactionMessage")).toBe(true);
    expect(mentions(include("replies").where, "reactionMessage")).toBe(false);
    expect(include("replies").required).toBe(false);
  });

  it("still fences replies to the client's tickets and the office", async () => {
    await ListMessagesService({
      ticketId: "301",
      companyId: 10,
      userId: 5
    });

    const fence = include("replies").where[Op.and];
    expect(fence).toEqual(
      expect.arrayContaining([
        { ticketId: { [Op.in]: [301, 200] } },
        { companyId: 10 }
      ])
    );
    expect(mentions(include("replies").where, "queueId")).toBe(!isAdmin);
    // the sector rule: the open ticket, the sector written on the message,
    // or no sector on a ticket that is in the sector of the attendant now
    const sector = {
      [Op.or]: [
        { ticketId: 301 },
        { queueId: { [Op.in]: [20] } },
        { queueId: null, ticketId: { [Op.in]: [301] } }
      ]
    };
    [lastQuery().where[Op.and], include("quotedMsg").where[Op.and], fence]
      .map(conditions =>
        conditions.filter(item => Op.or in item && !("mediaType" in item))
      )
      .forEach(found => expect(found).toEqual(isAdmin ? [] : [sector]));
  });
});
