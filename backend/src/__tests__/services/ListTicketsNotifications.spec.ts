import { Sequelize, WhereOptions } from "sequelize";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import Ticket from "../../models/Ticket";
import { loadTicketViewer } from "../../services/TicketServices/AuthorizeTicketContextService";
import ListTicketsService from "../../services/TicketServices/ListTicketsService";
import ShowUserService from "../../services/UserServices/ShowUserService";

jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
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

it("finds the customer name whatever its punctuation and spacing", async () => {
  viewer("admin", [401]);
  await ListTicketsService({
    ...baseRequest,
    queueIds: [401],
    isSearch: true,
    searchParam: "J.B. Fraga"
  });

  expect(listWhere()).toContain(
    'OR STRPOS(REGEXP_REPLACE(LOWER(UNACCENT("contact"."name")),'
  );
  expect(listWhere()).toContain(
    "NULLIF(REGEXP_REPLACE(LOWER(UNACCENT('j.b. fraga')),"
  );
});
