// Zap Komunick (RF-029): history imported from the previous system is read
// only. No action on one of its messages may look up a connection, because
// that would save the default connection on the closed imported ticket.
import BindDefaultWhatsapp from "../../helpers/BindDefaultWhatsapp";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import { isImportedMessage } from "../../helpers/ImportedMessage";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ForwardMessageService from "../../services/MessageServices/ForwardMessageService";
import CreateTicketService from "../../services/TicketServices/CreateTicketService";
import DeleteWhatsAppMessage from "../../services/WbotServices/DeleteWhatsAppMessage";
import EditWhatsAppMessage from "../../services/WbotServices/EditWhatsAppMessage";

jest.mock("libzapitu-rf", () => ({
  getContentType: jest.fn(),
  normalizeMessageContent: jest.fn()
}));
jest.mock("../../helpers/GetDefaultWhatsApp", () => jest.fn());
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/GetWbotMessage", () => jest.fn());
jest.mock("../../helpers/Mustache", () => jest.fn());
jest.mock("../../helpers/MessageSignature", () => ({
  formatSignedMessage: jest.fn(),
  isMessageSignatureRequired: jest.fn()
}));
jest.mock("../../helpers/CheckContactOpenTickets", () => jest.fn());
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../libs/wbot", () => ({ getWbot: jest.fn() }));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Message", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../models/OldMessage", () => ({}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  emitTicketContext: jest.fn()
}));
jest.mock("../../services/TicketServices/CreateTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/OpenTicketConflictService", () =>
  jest.fn()
);
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  verifyMediaMessage: jest.fn(),
  verifyMessage: jest.fn()
}));

const importedMessage = () => ({
  id: "zappy-88",
  fromMe: true,
  body: "mensagem fictícia",
  dataJson: null,
  remoteJid: null,
  companyId: 10,
  ticket: { id: 301, companyId: 10, whatsappId: null, whatsapp: null }
});

beforeEach(() => jest.clearAllMocks());

describe("imported message", () => {
  it("is the one without WhatsApp payload and without chat id", () => {
    expect(isImportedMessage({ dataJson: null, remoteJid: null })).toBe(true);
    expect(isImportedMessage({ dataJson: "{}", remoteJid: null })).toBe(false);
    expect(
      isImportedMessage({ dataJson: null, remoteJid: "5571@s.whatsapp.net" })
    ).toBe(false);
  });

  it("is not edited, and no connection is looked up", async () => {
    (Message.findOne as jest.Mock).mockResolvedValue(importedMessage());

    await expect(
      EditWhatsAppMessage({ messageId: "zappy-88", companyId: 10, body: "x" })
    ).rejects.toMatchObject({ message: "ERR_IMPORTED_MESSAGE_READ_ONLY" });
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });

  it("is not deleted, and no connection is looked up", async () => {
    (Message.findByPk as jest.Mock).mockResolvedValue(importedMessage());

    await expect(DeleteWhatsAppMessage("zappy-88")).rejects.toMatchObject({
      message: "ERR_IMPORTED_MESSAGE_READ_ONLY"
    });
    expect(GetWbotMessage).not.toHaveBeenCalled();
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });

  it("is not forwarded: says why before opening a ticket for the destination", async () => {
    await expect(
      ForwardMessageService(
        { id: 7, profile: "user", queues: [] } as unknown as User,
        importedMessage() as unknown as Message,
        { id: 20, companyId: 10, isGroup: false } as unknown as Contact,
        { id: 4 } as unknown as Queue
      )
    ).rejects.toMatchObject({ message: "ERR_FORWARD_IMPORTED_MESSAGE" });
    expect(GetDefaultWhatsApp).not.toHaveBeenCalled();
    expect(CreateTicketService).not.toHaveBeenCalled();
  });
});

describe("BindDefaultWhatsapp", () => {
  const ticketWith = (overrides = {}) => ({
    companyId: 10,
    channel: "whatsapp",
    whatsappId: null,
    $set: jest.fn(),
    ...overrides
  });

  it("gives the default connection to a ticket without one", async () => {
    const defaultWhatsapp = { id: 2 };
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(defaultWhatsapp);
    const ticket = ticketWith();

    await BindDefaultWhatsapp(ticket as unknown as Ticket);

    expect(GetDefaultWhatsApp).toHaveBeenCalledWith(10);
    expect(ticket.$set).toHaveBeenCalledWith("whatsapp", defaultWhatsapp);
  });

  it("keeps the connection the ticket has, and other channels alone", async () => {
    const withConnection = ticketWith({ whatsappId: 5 });
    const otherChannel = ticketWith({ channel: "facebook" });

    await BindDefaultWhatsapp(withConnection as unknown as Ticket);
    await BindDefaultWhatsapp(otherChannel as unknown as Ticket);

    expect(GetDefaultWhatsApp).not.toHaveBeenCalled();
    expect(withConnection.$set).not.toHaveBeenCalled();
    expect(otherChannel.$set).not.toHaveBeenCalled();
  });
});
