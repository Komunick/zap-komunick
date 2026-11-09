import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
import { startQueue } from "../../services/WbotServices/wbotMessageListener";

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
jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
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
    (GetCompanySetting as jest.Mock).mockResolvedValue("disabled");
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

  it("rejects a destination queue without a link to the ticket's WhatsApp before updating", async () => {
    const ticket = await ShowTicketService(301, 10);
    ticket.channel = "whatsapp";
    ticket.whatsappId = 501;
    (Queue.findByPk as jest.Mock).mockResolvedValue({ id: 402, companyId: 10 });
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      UpdateTicketService({
        ticketId: 301,
        reqUserId: 101,
        ticketData: { queueId: 402 }
      })
    ).rejects.toMatchObject({ message: "ERR_QUEUE_NOT_LINKED_TO_WHATSAPP" });

    expect(update).not.toHaveBeenCalled();
    expect(FindOrCreateATicketTrakingService).not.toHaveBeenCalled();
    expect(startQueue).not.toHaveBeenCalled();
  });

  it("keeps the original WhatsApp when transferring to another queue linked to it", async () => {
    const ticket = await ShowTicketService(301, 10);
    ticket.channel = "whatsapp";
    ticket.whatsappId = 501;
    (Queue.findByPk as jest.Mock).mockResolvedValue({ id: 402, companyId: 10 });
    (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 501 });

    await UpdateTicketService({
      ticketId: 301,
      reqUserId: 101,
      ticketData: { queueId: 402 }
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ queueId: 402, whatsappId: 501 })
    );
  });

  it.each(["enabled", "disabled"])(
    "closes a legacy mismatched ticket without sending rating or closure text (rating=%s)",
    async rating => {
      const ticket = await ShowTicketService(301, 10);
      ticket.channel = "whatsapp";
      ticket.whatsappId = 501;
      ticket.whatsapp = {
        status: "CONNECTED",
        complationMessage: "Encerrado"
      } as Whatsapp;
      ticket.user = { id: 101 } as User;
      ticket.contact.disableBot = false;
      (GetCompanySetting as jest.Mock).mockImplementation(async (_, key) =>
        key === "userRating" ? rating : "disabled"
      );
      (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);

      await UpdateTicketService({
        ticketId: 301,
        reqUserId: 101,
        ticketData: { status: "closed" }
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "closed" })
      );
      expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    }
  );

  it.each([401, null])(
    "sends the closure message for a compatible or queue-less ticket (%s)",
    async queueId => {
      const ticket = await ShowTicketService(301, 10);
      ticket.channel = "whatsapp";
      ticket.whatsappId = 501;
      ticket.queueId = queueId;
      ticket.whatsapp = {
        status: "CONNECTED",
        complationMessage: "Encerrado"
      } as Whatsapp;
      ticket.user = { id: 101 } as User;
      ticket.contact.disableBot = false;
      (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 501 });

      await UpdateTicketService({
        ticketId: 301,
        reqUserId: 101,
        ticketData: { status: "closed" }
      });

      expect(SendWhatsAppMessage).toHaveBeenCalledTimes(1);
      if (queueId === null) expect(Whatsapp.findOne).not.toHaveBeenCalled();
    }
  );

  it("accepts a legacy mismatched ticket without sending its acceptance text", async () => {
    const ticket = await ShowTicketService(301, 10);
    ticket.channel = "whatsapp";
    ticket.whatsappId = 501;
    ticket.whatsapp = { status: "CONNECTED" } as Whatsapp;
    ticket.contact.disableBot = false;
    (User.findOne as jest.Mock).mockResolvedValue({ id: 101 });
    (GetCompanySetting as jest.Mock).mockImplementation(async (_, key) =>
      key === "ticketAcceptedMessage" ? "Aceito" : "disabled"
    );
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);
    const sendMessage = jest.fn();
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await UpdateTicketService({
      ticketId: 301,
      reqUserId: 101,
      ticketData: { status: "open", userId: 101 }
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", userId: 101 })
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
