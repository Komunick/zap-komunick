import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { Session } from "../../libs/wbot";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import VerifyCurrentSchedule from "../../services/CompanyService/VerifyCurrentSchedule";
import CreateMessageService from "../../services/MessageServices/CreateMessageService";
import { authorizeQueueOption } from "../../services/QueueOptionService/AuthorizeQueueOptionService";
import FindOrCreateTicketService from "../../services/TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import { verifyContact } from "../../services/WbotServices/verifyContact";
import {
  handleMessage,
  startQueue
} from "../../services/WbotServices/wbotMessageListener";
import ShowWhatsAppService from "../../services/WhatsappService/ShowWhatsAppService";

jest.mock("libzapitu-rf", () => ({
  getContentType: () => "conversation",
  extractMessageContent: value => value
}));
jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn().mockResolvedValue("disabled")
}));
jest.mock("../../helpers/CheckCompanyCompliant", () => ({
  checkCompanyCompliant: jest.fn().mockResolvedValue(true)
}));
jest.mock("../../helpers/Mustache", () =>
  jest.fn((body, ticket) => body.replace("{{queue}}", ticket.queue?.name))
);
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/transcriber", () => ({}));
jest.mock("../../queues/campaign", () => ({}));
jest.mock("../../services/CompanyService/VerifyCurrentSchedule", () =>
  jest.fn()
);
jest.mock("../../services/CredentialServices/CredentialService", () => ({}));
jest.mock("../../services/MessageServices/CreateMessageService", () =>
  jest.fn()
);
jest.mock(
  "../../services/QueueOptionService/AuthorizeQueueOptionService",
  () => ({
    authorizeQueueOption: jest.fn()
  })
);
jest.mock("../../services/TicketServices/FindOrCreateTicketService", () =>
  jest.fn()
);
jest.mock("../../services/TicketServices/UpdateTicketService", () => jest.fn());
jest.mock("../../services/TranslationServices/i18nService", () => ({}));
jest.mock("../../services/WbotServices/SendWhatsAppMedia", () => ({}));
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../services/WbotServices/verifyContact", () => ({
  verifyContact: jest.fn()
}));
jest.mock("../../services/WhatsappService/ShowWhatsAppService", () =>
  jest.fn()
);

const queue = {
  id: 42,
  companyId: 10,
  name: "Cidadela fictícia",
  greetingMessage: "Olá, você chegou a {{queue}}.",
  mediaPath: null,
  options: []
} as Queue;

const makeTicket = () =>
  ({
    id: 301,
    companyId: 10,
    whatsappId: 501,
    queueId: 41,
    queue: { id: 41, name: "Casseb fictício" },
    status: "pending",
    channel: "whatsapp",
    contact: { id: 201, companyId: 10 },
    update: jest.fn(),
    reload: jest.fn()
  }) as unknown as Ticket;

const makeSocket = (id: number) =>
  ({
    id,
    sendMessage: jest.fn().mockResolvedValue({
      key: { id: "fictitious", fromMe: true },
      message: { conversation: "fixture" }
    })
  }) as unknown as Session;

it("leaves an incompatible queue unchanged and sends no automatic content", async () => {
  const wbot = makeSocket(501);
  (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);
  await startQueue(wbot, makeTicket(), queue);

  expect(UpdateTicketService).not.toHaveBeenCalled();
  expect(wbot.sendMessage).not.toHaveBeenCalled();
});

it("uses the destination queue when formatting a greeting on the same channel", async () => {
  const ticket = makeTicket();
  const wbot = makeSocket(501);
  (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 501 });
  (UpdateTicketService as jest.Mock).mockResolvedValue({
    ticket: { ...ticket, queueId: queue.id, queue }
  });
  await startQueue(wbot, ticket, queue);

  expect(wbot.sendMessage).toHaveBeenCalledWith(undefined, {
    text: "Olá, você chegou a Cidadela fictícia."
  });
});

describe("automatic replies to incoming messages", () => {
  const inbound = {
    key: { id: "incoming-fixture", remoteJid: "000@s.whatsapp.net" },
    message: { conversation: "fixture" }
  };

  beforeEach(() => {
    const ticket = makeTicket();
    (verifyContact as jest.Mock).mockResolvedValue(ticket.contact);
    (FindOrCreateTicketService as jest.Mock).mockResolvedValue({ ticket });
    (GetCompanySetting as jest.Mock).mockResolvedValue("disabled");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("stores the incoming message without sending hours text from an incompatible legacy queue", async () => {
    const wbot = makeSocket(501);
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({ queues: [queue] });
    (GetCompanySetting as jest.Mock).mockImplementation(async (_, key) =>
      key === "scheduleType" ? "queue" : "disabled"
    );
    (VerifyCurrentSchedule as jest.Mock).mockResolvedValue({
      inActivity: false
    });
    jest.spyOn(Queue, "findByPk").mockResolvedValue({
      id: 41,
      outOfHoursMessage: "Outro setor"
    } as Queue);

    await handleMessage(inbound, wbot, 10);

    expect(CreateMessageService).toHaveBeenCalledTimes(1);
    expect(VerifyCurrentSchedule).not.toHaveBeenCalled();
    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  it("blocks a chatbot option that forwards to a queue on a different WhatsApp", async () => {
    const wbot = makeSocket(501);
    const ticket = makeTicket();
    const sourceQueue = { ...queue, id: ticket.queueId } as Queue;
    ticket.chatbot = true;
    ticket.queueOptionId = 99;
    (FindOrCreateTicketService as jest.Mock).mockResolvedValue({ ticket });
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      queues: [sourceQueue]
    });
    (Whatsapp.findOne as jest.Mock).mockImplementation(async ({ include }) =>
      include[0].where.id === sourceQueue.id ? { id: 501 } : null
    );
    (authorizeQueueOption as jest.Mock).mockResolvedValue({
      queue: sourceQueue
    });
    jest.spyOn(Queue, "findByPk").mockResolvedValue(sourceQueue);
    jest.spyOn(Queue, "findOne").mockResolvedValue(sourceQueue);
    jest.spyOn(QueueOption, "count").mockResolvedValue(0);
    jest.spyOn(QueueOption, "findOne").mockResolvedValue(null);
    const option = jest.spyOn(QueueOption, "findByPk").mockResolvedValue({
      forwardQueueId: queue.id,
      forwardQueue: queue,
      mediaPath: null,
      message: "Encaminhando ao outro setor"
    } as QueueOption);

    await handleMessage(inbound, wbot, 10);

    expect(CreateMessageService).toHaveBeenCalledTimes(1);
    expect(option).toHaveBeenCalledWith(99, expect.any(Object));
    expect(wbot.sendMessage).not.toHaveBeenCalled();
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});
