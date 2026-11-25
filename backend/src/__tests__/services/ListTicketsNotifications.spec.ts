import { Sequelize, WhereOptions } from "sequelize";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import Ticket from "../../models/Ticket";
import { loadTicketViewer } from "../../services/TicketServices/AuthorizeTicketContextService";
import ListTicketsService from "../../services/TicketServices/ListTicketsService";
import ShowUserService from "../../services/UserServices/ShowUserService";
import { loadMemberGeneralTriageScope } from "../../helpers/GeneralTriage";

jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../models/Setting", () => ({}));
jest.mock("../../helpers/GeneralTriage", () => ({
  ...jest.requireActual("../../helpers/GeneralTriage"),
  loadMemberGeneralTriageScope: jest.fn()
}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/ContactTag", () => ({}));
jest.mock("../../models/Message", () => ({}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Tag", () => ({}));
jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../models/TicketTag", () => ({}));
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Whatsapp", () => ({}));
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({
    loadTicketViewer: jest.fn()
  })
);
jest.mock("../../services/UserServices/ShowUserService", () => jest.fn());

const sequelize = new Sequelize({ dialect: "postgres", logging: false });
const generator = sequelize.getQueryInterface().queryGenerator as {
  getWhereConditions(whereClause: WhereOptions): string;
};
const baseRequest = {
  companyId: 10,
  userId: "101",
  queueIds: [],
  tags: [],
  users: []
};

const listWhere = () => {
  const calls = (Ticket.findAll as jest.Mock).mock.calls;
  return generator.getWhereConditions(calls[calls.length - 1][0].where);
};

const viewer = (profile: string, queueIds: number[]) => {
  (ShowUserService as jest.Mock).mockResolvedValue({ profile });
  (loadTicketViewer as jest.Mock).mockResolvedValue({
    companyId: 10,
    isAdmin: profile === "admin",
    queueIds
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (GetCompanySetting as jest.Mock).mockResolvedValue("disabled");
  (Ticket.findAll as jest.Mock).mockResolvedValue([]);
  // by default the company has no general triage (or the viewer is not in it)
  (loadMemberGeneralTriageScope as jest.Mock).mockResolvedValue(null);
});

afterAll(async () => {
  await sequelize.close();
});

it.each(["user", "admin"])(
  "uses current sector membership for %s notification lists",
  async profile => {
    viewer(profile, [401, 402]);
    await ListTicketsService({
      ...baseRequest,
      queueIds: [499],
      showAll: "true",
      withUnreadMessages: "true",
      notClosed: true
    });
    const where = listWhere();

    expect(where).toContain('"companyId" = 10');
    expect(where).toContain('"queueId" IN (401, 402)');
    expect(where).not.toContain("499");
    expect(where).not.toContain('"queueId" IS NULL');
    expect(where).toContain("\"userId\" = '101'");
    expect(where).toContain('"status" = \'pending\' AND "userId" IS NULL');
    expect(where).toContain("\"status\" != 'closed'");
    expect(where).toContain('"unreadMessages" > 0');
  }
);

it("returns no notifications for an admin without sectors", async () => {
  viewer("admin", []);
  await ListTicketsService({
    ...baseRequest,
    withUnreadMessages: "true",
    notClosed: true
  });

  expect(listWhere()).toContain('"queueId" IN (NULL)');
  expect(listWhere()).not.toContain('"queueId" IS NULL');
});

it("preserves the admin ticket list when opening the normal all view", async () => {
  viewer("admin", [401]);
  await ListTicketsService({
    ...baseRequest,
    queueIds: [402],
    showAll: "true"
  });

  expect(listWhere()).toContain('"queueId" IN (402) OR "queueId" IS NULL');
  expect(listWhere()).not.toContain('"queueId" IN (401)');
});

// Zap Komunick (RF-033): a conversation waiting for the customer to pick a
// sector shows right away for whoever belongs to the general queue.
describe("conversations waiting for a sector", () => {
  const GENERAL = 407;
  const WAITING =
    '"status" = \'pending\' AND "channel" = \'whatsapp\' AND "isGroup" = false AND "queueId" IS NULL AND "userId" IS NULL AND "generalTriageStartedAt" IS NOT NULL AND "whatsappId" IN (2)';
  const member = () =>
    (loadMemberGeneralTriageScope as jest.Mock).mockResolvedValue({
      queueId: GENERAL,
      whatsappIds: [2]
    });

  it("are listed for an attendant of the general queue, as if they were in it", async () => {
    viewer("user", [401, GENERAL]);
    member();
    await ListTicketsService({
      ...baseRequest,
      queueIds: [401, GENERAL],
      status: "pending"
    });
    const where = listWhere();

    expect(loadMemberGeneralTriageScope).toHaveBeenCalledWith(10, [
      401,
      GENERAL
    ]);
    // both the chips and the sector fence let the waiting conversations in
    expect(where).toContain(`("queueId" IN (401, ${GENERAL}) OR (${WAITING}))`);
    expect(where.split(WAITING)).toHaveLength(3);
    expect(where).toContain('"companyId" = 10');
    expect(where).toContain("\"status\" = 'pending'");
  });

  it("hide when the chip of the general queue is switched off", async () => {
    viewer("user", [401, GENERAL]);
    member();
    await ListTicketsService({
      ...baseRequest,
      queueIds: [401],
      status: "pending"
    });
    const where = listWhere();

    // the chips ask for sector 401 only: nothing without a sector passes
    expect(where).toContain('"queueId" IN (401)');
    expect(where.split(WAITING)).toHaveLength(2);
    // and that requirement is ANDed with the rest, not an alternative to it
    expect(where).toContain('AND ("queueId" IN (401)) AND');
  });

  it("are not listed for an attendant who is not of the general queue", async () => {
    viewer("user", [401, 402]);
    await ListTicketsService({
      ...baseRequest,
      queueIds: [401, 402],
      status: "pending"
    });
    const where = listWhere();

    expect(where).not.toContain('"queueId" IS NULL');
    expect(where).not.toContain("generalTriageStartedAt");
    expect(where).toContain('"queueId" IN (401, 402)');
  });

  it("notify the attendants of the general queue", async () => {
    viewer("user", [401, GENERAL]);
    member();
    await ListTicketsService({
      ...baseRequest,
      withUnreadMessages: "true",
      notClosed: true
    });
    const where = listWhere();

    expect(where).toContain(`("queueId" IN (401, ${GENERAL}) OR (${WAITING}))`);
    expect(where).toContain('"unreadMessages" > 0');
    expect(where).toContain("\"status\" != 'closed'");
  });

  it("change nothing in the list of an administrator", async () => {
    viewer("admin", [GENERAL]);
    member();
    await ListTicketsService({
      ...baseRequest,
      queueIds: [GENERAL],
      status: "pending"
    });
    const where = listWhere();

    // an administrator already sees every ticket without a sector
    expect(loadMemberGeneralTriageScope).not.toHaveBeenCalled();
    expect(where).toContain(`"queueId" IN (${GENERAL}) OR "queueId" IS NULL`);
    expect(where).not.toContain("generalTriageStartedAt");
  });

  it("never leave the company of the viewer", async () => {
    viewer("user", [GENERAL]);
    member();
    await ListTicketsService({
      ...baseRequest,
      queueIds: [GENERAL],
      status: "pending"
    });
    // the company is required outside every alternative
    expect(listWhere()).toMatch(/^\(.*\) AND "companyId" = 10$/);
  });
});
