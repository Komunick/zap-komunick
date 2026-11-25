import { Op } from "sequelize";
import { ticketNoteScope } from "../../services/TicketNoteService/TicketNoteScope";
import {
  GetSettingService,
  safeSettingsKeys
} from "../../services/SettingServices/GetSettingService";
import Setting from "../../models/Setting";

jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({
  findOne: jest.fn(),
  findAll: jest.fn()
}));
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({ __esModule: true, default: jest.fn(), loadTicketViewer: jest.fn() })
);

const attendant = { companyId: 10, isAdmin: false, queueIds: [7, 8] };
const ticketWhere = (include: ReturnType<typeof ticketNoteScope>) =>
  (include[1] as { where: Record<string | symbol, unknown> }).where;

describe("the notes of a ticket", () => {
  it("keep the sector fence wherever notes of several tickets are listed", () => {
    const where = ticketWhere(ticketNoteScope(attendant));
    expect(where.queueId).toEqual({ [Op.in]: [7, 8] });
    expect(where.companyId).toBe(10);
  });

  it("drop the fence only for the one ticket that was just authorized", () => {
    // a conversation waiting for a sector has no queue: its notes must not
    // vanish from the person who may read and write them
    const where = ticketWhere(
      ticketNoteScope(attendant, { authorizedTicket: true })
    );
    expect(where).not.toHaveProperty("queueId");
    // the company and the contact pairing are still required
    expect(where.companyId).toBe(10);
    expect(where[Op.and as unknown as string]).toHaveLength(1);
  });

  it("never fence an administrator, as before", () => {
    const admin = { companyId: 10, isAdmin: true, queueIds: [] };
    expect(ticketWhere(ticketNoteScope(admin))).not.toHaveProperty("queueId");
  });
});

describe("which queue is the general one", () => {
  const user = { id: 101, profile: "user", companyId: 10 };

  it("may be read by an attendant, for the queue filter of the list", async () => {
    expect(safeSettingsKeys).toHaveProperty("generalTriageQueueId", "");
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "7" });
    await expect(
      GetSettingService({ key: "generalTriageQueueId", user })
    ).resolves.toBe("7");
    expect(Setting.findOne).toHaveBeenCalledWith({
      where: { companyId: 10, key: "generalTriageQueueId" }
    });
  });

  it("is empty for a company without the triage", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      GetSettingService({ key: "generalTriageQueueId", user })
    ).resolves.toBe("");
  });

  it("does not open the other settings of the triage, nor anything else", async () => {
    await expect(
      GetSettingService({ key: "generalTriageTimeoutMinutes", user })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      GetSettingService({ key: "userApiToken", user })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
