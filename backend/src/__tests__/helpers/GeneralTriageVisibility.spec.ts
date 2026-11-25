import { Sequelize, WhereOptions } from "sequelize";
import {
  generalTriageWaitWhere,
  isWaitingInGeneralTriage,
  loadGeneralTriageScope,
  loadMemberGeneralTriageScope
} from "../../helpers/GeneralTriage";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";

jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({ findAll: jest.fn() }));

// A conversation whose customer has not picked a sector yet.
const waiting = {
  status: "pending",
  channel: "whatsapp",
  isGroup: false,
  queueId: null,
  userId: null,
  generalTriageStartedAt: new Date("2026-11-25T14:11:00Z"),
  whatsappId: 2
};
const scope = { queueId: 7, whatsappIds: [2, 5] };

describe("isWaitingInGeneralTriage", () => {
  it("is a pending WhatsApp conversation without sector whose wait has started", () => {
    expect(isWaitingInGeneralTriage(waiting, scope)).toBe(true);
  });

  it.each([
    ["already has a sector", { queueId: 8 }],
    ["was already taken by someone", { userId: 3 }],
    ["is in service", { status: "open" }],
    ["is closed", { status: "closed" }],
    ["is a group", { isGroup: true }],
    [
      "never entered the wait (started from the phone)",
      {
        generalTriageStartedAt: null
      }
    ],
    ["is of a connection outside the general queue", { whatsappId: 9 }],
    ["has no connection", { whatsappId: null }],
    ["is of another channel", { channel: "email" }]
  ])("is not a conversation that %s", (_reason, change) => {
    expect(isWaitingInGeneralTriage({ ...waiting, ...change }, scope)).toBe(
      false
    );
  });

  it("is never true without the triage of the company", () => {
    expect(isWaitingInGeneralTriage(waiting, null)).toBe(false);
    expect(isWaitingInGeneralTriage(waiting, undefined)).toBe(false);
    expect(isWaitingInGeneralTriage(null, scope)).toBe(false);
    expect(
      isWaitingInGeneralTriage(waiting, { queueId: 7, whatsappIds: [] })
    ).toBe(false);
  });
});

describe("generalTriageWaitWhere", () => {
  const sequelize = new Sequelize({ dialect: "postgres", logging: false });
  const sql = (where: WhereOptions) =>
    (
      sequelize.getQueryInterface().queryGenerator as unknown as {
        getWhereConditions(whereClause: WhereOptions): string;
      }
    ).getWhereConditions(where);
  afterAll(() => sequelize.close());

  it("is the same rule as a filter of the table", () => {
    const where = sql(generalTriageWaitWhere(scope));
    [
      "\"status\" = 'pending'",
      "\"channel\" = 'whatsapp'",
      '"isGroup" = false',
      '"queueId" IS NULL',
      '"userId" IS NULL',
      '"generalTriageStartedAt" IS NOT NULL',
      '"whatsappId" IN (2, 5)'
    ].forEach(part => expect(where).toContain(part));
    // every condition is required: none is an alternative
    expect(where).not.toContain(" OR ");
  });
});

describe("the scope of the general triage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "7" }]);
    (Whatsapp.findAll as jest.Mock).mockResolvedValue([{ id: 2 }, { id: 5 }]);
  });

  it("is the general queue and the connections linked to it, in the company", async () => {
    await expect(loadGeneralTriageScope(10)).resolves.toEqual(scope);
    expect(Setting.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, key: "generalTriageQueueId" }
      })
    );
    const query = (Whatsapp.findAll as jest.Mock).mock.calls[0][0];
    expect(query.where).toEqual({ companyId: 10, channel: "whatsapp" });
    expect(query.include[0].where).toEqual({ id: 7, companyId: 10 });
    expect(query.include[0].required).toBe(true);
  });

  it("does not exist when the triage is off or the queue has no connection", async () => {
    (Setting.findAll as jest.Mock).mockResolvedValue([]);
    await expect(loadGeneralTriageScope(10)).resolves.toBeNull();
    expect(Whatsapp.findAll).not.toHaveBeenCalled();

    (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "0" }]);
    await expect(loadGeneralTriageScope(10)).resolves.toBeNull();

    (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "7" }]);
    (Whatsapp.findAll as jest.Mock).mockResolvedValue([]);
    await expect(loadGeneralTriageScope(10)).resolves.toBeNull();
  });

  it("is only given to whoever belongs to the general queue", async () => {
    await expect(loadMemberGeneralTriageScope(10, [3, 7])).resolves.toEqual(
      scope
    );
    await expect(loadMemberGeneralTriageScope(10, [3, 8])).resolves.toBeNull();
  });

  it("is not even looked up for someone without any sector", async () => {
    await expect(loadMemberGeneralTriageScope(10, [])).resolves.toBeNull();
    expect(Setting.findAll).not.toHaveBeenCalled();
  });
});
