import { Request, Response } from "express";
import * as MessageController from "../../controllers/MessageController";
import AppError from "../../errors/AppError";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../../services/MessageServices/AuthorizeMessageContextService";
import DeleteWhatsAppMessage from "../../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
import ListMessagesService from "../../services/MessageServices/ListMessagesService";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import Message from "../../models/Message";
import OldMessage from "../../models/OldMessage";

jest.mock("../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Whatsapp", () => ({}));
jest.mock("../../models/Message", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/OldMessage", () => ({ findAll: jest.fn() }));
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

  it("returns edits only for the exact authorized ticket when message IDs repeat", async () => {
    const { messageId } = req.params;
    const ticket = { id: 301 };
    const allowed = {
      messageId,
      ticketId: 301,
      body: "Edicao da propria fila"
    };
    const forbidden = {
      messageId,
      ticketId: 302,
      body: "Edicao de outra fila"
    };
    (Message.findOne as jest.Mock).mockResolvedValue({ id: messageId, ticket });
    (AuthorizeTicketContextService as jest.Mock).mockResolvedValue({ ticket });
    (OldMessage.findAll as jest.Mock).mockImplementation(async ({ where }) =>
      [allowed, forbidden].filter(edit =>
        Object.entries(where).every(([field, value]) => edit[field] === value)
      )
    );

    await MessageController.historyByMessageId(req, res);

    expect(AuthorizeTicketContextService).toHaveBeenCalledWith(301, {
      userId: "101",
      companyId: 10
    });
    expect(res.json).toHaveBeenCalledWith({ oldMessages: [allowed] });
  });

  it("uses the authorized composite source for an outgoing quoted message", async () => {
    const actor = { userId: "101", companyId: 10 };
    const source = { id: "duplicate", ticketId: 300 };
    const ticket = { id: 301, channel: "whatsapp", isGroup: true };
    req.files = undefined;
    req.body.quotedMsg = { ...source, dataJson: "untrusted request snapshot" };
    (AuthorizeTicketContextService as jest.Mock).mockResolvedValue({ ticket });
    (AuthorizeMessageContextService as jest.Mock).mockResolvedValue(source);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);

    await MessageController.store(req, res);

    expect(AuthorizeMessageContextService).toHaveBeenCalledWith(
      "duplicate",
      actor,
      "301",
      300
    );
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ quotedMsg: source })
    );
  });

  it("omits only unverified inline quote content from the history response", async () => {
    const quotedMessage = { conversation: "Conteudo de origem" };
    const dataJson = JSON.stringify({
      message: {
        extendedTextMessage: {
          text: "Texto atual",
          contextInfo: { isForwarded: true, quotedMessage }
        }
      }
    });
    const fixture = { id: "current", dataJson, quotedMsg: null };
    const verified = {
      ...fixture,
      id: "with-verified-quote",
      quotedMsg: {
        id: "origin",
        ticketId: 301,
        body: quotedMessage.conversation,
        dataJson: JSON.stringify({ message: quotedMessage })
      }
    };
    (ListMessagesService as jest.Mock).mockResolvedValue({
      messages: [{ toJSON: () => fixture }, { toJSON: () => verified }],
      ticket: { id: 301, channel: "whatsapp" }
    });
    req.query.markAsRead = "false";

    await MessageController.index(req, res);

    const [deniedQuote, allowedQuote] = (res.json as jest.Mock).mock.calls[0][0]
      .messages;
    expect(
      JSON.parse(deniedQuote.dataJson).message.extendedTextMessage
    ).toEqual({
      text: "Texto atual",
      contextInfo: { isForwarded: true }
    });
    expect(allowedQuote).toEqual(verified);
    expect(fixture.dataJson).toBe(dataJson);
    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
  });
});
