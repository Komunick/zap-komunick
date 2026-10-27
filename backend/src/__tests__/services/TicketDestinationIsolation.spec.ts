import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import User from "../../models/User";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";

jest.mock("../../helpers/CheckContactOpenTickets", () => jest.fn());
jest.mock("../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: jest.fn().mockReturnThis(), emit: jest.fn() })
}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Queue", () => ({ findByPk: jest.fn() }));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock(
  "../../services/TicketServices/FindOrCreateATicketTrakingService",
  () => jest.fn()
);
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  startQueue: jest.fn(),
  verifyMessage: jest.fn()
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn().mockResolvedValue("disabled")
}));
jest.mock("../../helpers/Mustache", () => jest.fn());
jest.mock("../../utils/logger", () => ({ logger: { error: jest.fn() } }));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  emitTicketContext: jest.fn(),
  revokeTicketContextRooms: jest.fn()
}));
jest.mock("../../services/CounterServices/IncrementCounter", () => ({
  incrementCounter: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../services/TranslationServices/i18nService", () => ({
  _t: jest.fn()
}));
jest.mock("../../services/CloseReasonServices/CloseReasonService", () => ({
  ActiveCloseReasonIds: jest.fn()
}));

describe("destination user belongs to the ticket office", () => {
  const update = jest.fn();
  beforeEach(() => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "admin"
    });
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 301,
      companyId: 10,
      userId: 101,
      queueId: 401,
      status: "open",
      channel: "email",
      contact: { disableBot: true },
      update,
      reload: jest.fn()
    });
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
      startedAt: new Date(),
      save: jest.fn()
    });
    (User.findOne as jest.Mock).mockResolvedValue(null);
  });

  it("rejects another office's destination user before changing ticket or tracking", async () => {
    await expect(
      UpdateTicketService({
        ticketId: 301,
        reqUserId: 101,
        ticketData: { userId: 201 }
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(update).not.toHaveBeenCalled();
    expect(FindOrCreateATicketTrakingService).not.toHaveBeenCalled();
  });

  it("preserves an allowed destination in the same office", async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ id: 102 });
    await UpdateTicketService({
      ticketId: 301,
      reqUserId: 101,
      ticketData: { userId: 102 }
    });
    expect(User.findOne).toHaveBeenCalledWith({
      where: { id: 102, companyId: 10 },
      attributes: ["id"]
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 102 })
    );
  });
});
