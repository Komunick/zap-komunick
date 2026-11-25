import fs from "fs";
import os from "os";
import path from "path";
import { Request, Response } from "express";
import * as MessageController from "../../controllers/MessageController";
import AppError from "../../errors/AppError";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../../services/MessageServices/AuthorizeMessageContextService";
import DeleteWhatsAppMessage from "../../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
import ListMessagesService from "../../services/MessageServices/ListMessagesService";
import ShowPendingMessagePreviewService from "../../services/MessageServices/ShowPendingMessagePreviewService";
import BindDefaultWhatsapp from "../../helpers/BindDefaultWhatsapp";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { isMessageSignatureRequired } from "../../helpers/MessageSignature";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import Message from "../../models/Message";
import OldMessage from "../../models/OldMessage";

jest.mock("../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../helpers/BindDefaultWhatsapp", () => jest.fn());
jest.mock("../../helpers/MessageSignature", () => ({
  isMessageSignatureRequired: jest.fn()
}));
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
jest.mock(
  "../../services/MessageServices/ShowPendingMessagePreviewService",
  () => jest.fn()
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
    jest.clearAllMocks();
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
    expect(isMessageSignatureRequired).not.toHaveBeenCalled();
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

  it("returns an uncached preview without marking read even when requested", async () => {
    const messages = [
      { id: "m1", fromMe: false, kind: "text", text: "Mensagem fictícia" },
      { id: "m2", fromMe: true, kind: "text", text: "Menu fictício" }
    ];
    res.set = jest.fn().mockReturnValue(res);
    (ShowPendingMessagePreviewService as jest.Mock).mockResolvedValue({
      messages,
      truncated: false
    });

    await MessageController.preview(req, res);

    expect(ShowPendingMessagePreviewService).toHaveBeenCalledWith("301", {
      userId: "101",
      companyId: 10
    });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.json).toHaveBeenCalledWith({
      preview: { kind: "text", text: "Mensagem fictícia" },
      messages,
      truncated: false
    });
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

  it("loads the signature policy only from the authorized company for a manual text", async () => {
    const ticket = { id: 301, channel: "whatsapp", isGroup: true };
    req.files = undefined;
    req.body.companyId = 20;
    req.body.forceSignature = false;
    (AuthorizeTicketContextService as jest.Mock).mockResolvedValue({ ticket });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (isMessageSignatureRequired as jest.Mock).mockResolvedValue(true);

    await MessageController.store(req, res);

    // Zap Komunick: a ticket without connection takes the default one when
    // it is answered (RF-029)
    expect(BindDefaultWhatsapp).toHaveBeenCalledWith(ticket);
    expect(isMessageSignatureRequired).toHaveBeenCalledWith(10);
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Fixture",
        forceSignature: true,
        ticket,
        userId: 101
      })
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

// Zap Komunick: several files sent at once from the ticket screen.
describe("files sent from the ticket screen", () => {
  const ticket = { id: 301, channel: "whatsapp", isGroup: true };
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "zapk-store-"));
  let req: Request;
  let res: Response;

  const upload = (name: string): Express.Multer.File => {
    const stored = path.join(folder, name);
    fs.writeFileSync(stored, "ficticio");
    return { originalname: name, path: stored } as Express.Multer.File;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { ticketId: "301" },
      body: {},
      files: [upload("a.pdf"), upload("b.jpg"), upload("c.pdf")],
      user: { id: "101", companyId: 10, profile: "user" }
    } as unknown as Request;
    res = { send: jest.fn() } as unknown as Response;
    (AuthorizeTicketContextService as jest.Mock).mockResolvedValue({ ticket });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
  });

  afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

  it("go to WhatsApp one at a time, in the order chosen, and leave no uploaded copy", async () => {
    const events: string[] = [];
    (SendWhatsAppMedia as jest.Mock).mockImplementation(async ({ media }) => {
      events.push(`envia ${media.originalname}`);
      await new Promise(resolve => {
        setTimeout(resolve, 15);
      });
      events.push(`enviado ${media.originalname}`);
    });

    await MessageController.store(req, res);

    expect(events).toEqual([
      "envia a.pdf",
      "enviado a.pdf",
      "envia b.jpg",
      "enviado b.jpg",
      "envia c.pdf",
      "enviado c.pdf"
    ]);
    expect(SendWhatsAppMedia).toHaveBeenCalledWith(
      expect.objectContaining({ ticket })
    );
    expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(res.send).toHaveBeenCalled();
  });

  it("stop at the file that fails, answer with its error and leave no uploaded copy", async () => {
    const failure = new AppError("ERR_SENDING_WAPP_MSG");
    (SendWhatsAppMedia as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(failure);

    await expect(MessageController.store(req, res)).rejects.toBe(failure);

    expect(SendWhatsAppMedia).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(res.send).not.toHaveBeenCalled();
  });

  it("refuse a send of files that arrives without any file, before touching the ticket", async () => {
    req.files = [];

    await expect(MessageController.store(req, res)).rejects.toMatchObject({
      message: "ERR_NO_MEDIA_RECEIVED",
      statusCode: 400
    });

    expect(AuthorizeTicketContextService).toHaveBeenCalled();
    expect(BindDefaultWhatsapp).not.toHaveBeenCalled();
    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
    expect(SendWhatsAppMedia).not.toHaveBeenCalled();
    expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it("send the text when the multipart request brings text and no file", async () => {
    req.files = [];
    req.body = { body: "Segue o texto" };

    await MessageController.store(req, res);

    expect(SendWhatsAppMedia).not.toHaveBeenCalled();
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Segue o texto", ticket })
    );
  });
});
