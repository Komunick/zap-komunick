import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ListMessagesService from "../../services/MessageServices/ListMessagesService";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import { GetCompanySetting } from "../../helpers/CheckSettings";

jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  findOne: jest.fn()
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
  (Ticket.findAll as jest.Mock).mockResolvedValue([{ id: 301 }, { id: 200 }]);
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
  });
});
