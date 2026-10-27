import { Request, Response } from "express";
import * as MessageController from "../../controllers/MessageController";
import AppError from "../../errors/AppError";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../../services/MessageServices/AuthorizeMessageContextService";
import DeleteWhatsAppMessage from "../../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
import ListMessagesService from "../../services/MessageServices/ListMessagesService";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

jest.mock("../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Whatsapp", () => ({}));
jest.mock("../../models/Message", () => ({}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/OldMessage", () => ({}));
jest.mock("../../services/MessageServices/ListMessagesService", () =>
  jest.fn()
);
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/WbotServices/DeleteWhatsAppMessage", () => jest.fn());
jest.mock("../../services/WbotServices/SendWhatsAppMedia", () => jest.fn());
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock("../../services/WbotServices/CheckNumber", () => jest.fn());
jest.mock("../../services/WbotServices/EditWhatsAppMessage", () => jest.fn());
jest.mock("../../utils/logger", () => ({ logger: { error: jest.fn() } }));
jest.mock("../../services/MessageServices/ForwardMessageService", () =>
  jest.fn()
);
jest.mock("../../libs/wbot", () => ({ getWbot: jest.fn() }));
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  verifyMessage: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../services/ContactServices/ShowContactService", () => jest.fn());
jest.mock("../../services/WbotServices/verifyContact", () => ({
  verifyContact: jest.fn()
}));
jest.mock("../../services/TicketServices/AuthorizeTicketContextService", () =>
  jest.fn()
);
jest.mock("../../services/MessageServices/AuthorizeMessageContextService", () =>
  jest.fn()
);

describe("message authorization before side effects", () => {
  const denied = new AppError("ERR_NO_PERMISSION", 403);
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = {
      params: { messageId: "fixture-message-B", ticketId: "301" },
      query: { markAsRead: "true" },
      body: { body: "Fixture" },
      files: [],
      user: { id: "101", companyId: 10, profile: "user" }
    } as unknown as Request;
    res = { send: jest.fn(), json: jest.fn() } as unknown as Response;
  });

  it("does not delete a WhatsApp message denied by the context guard", async () => {
    (AuthorizeMessageContextService as jest.Mock).mockRejectedValue(denied);
    await expect(MessageController.remove(req, res)).rejects.toBe(denied);
    expect(DeleteWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("does not send or mark messages read when the ticket is denied", async () => {
    (AuthorizeTicketContextService as jest.Mock).mockRejectedValue(denied);
    await expect(MessageController.store(req, res)).rejects.toBe(denied);
    expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
  });

  it("does not mark read when listing context is denied", async () => {
    (ListMessagesService as jest.Mock).mockRejectedValue(denied);
    await expect(MessageController.index(req, res)).rejects.toBe(denied);
    expect(ListMessagesService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "101",
        companyId: 10,
        ticketId: "301"
      })
    );
    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
  });
});
