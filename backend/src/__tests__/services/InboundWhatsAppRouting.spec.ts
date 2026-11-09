import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import { Session } from "../../libs/wbot";
import { checkCompanyCompliant } from "../../helpers/CheckCompanyCompliant";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import VerifyCurrentSchedule from "../../services/CompanyService/VerifyCurrentSchedule";
import { revokeTicketContextRooms } from "../../services/SocketServices/TicketContextSocketService";
import UpdateTicketService, {
  websocketUpdateTicket
} from "../../services/TicketServices/UpdateTicketService";
import { handleMessage } from "../../services/WbotServices/wbotMessageListener";
import { verifyContact } from "../../services/WbotServices/verifyContact";
import ShowWhatsAppService from "../../services/WhatsappService/ShowWhatsAppService";

jest.mock("libzapitu-rf", () => ({
  getContentType: value => Object.keys(value)[0],
  extractMessageContent: value => value
}));
jest.mock("../../database", () => ({
  transaction: (callback: () => Promise<unknown>) => callback()
}));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Message", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  upsert: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../helpers/CheckCompanyCompliant", () => ({
  checkCompanyCompliant: jest.fn().mockResolvedValue(true)
}));
jest.mock("../../helpers/Mustache", () => (body: string) => body);
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/transcriber", () => ({}));
jest.mock("../../queues/campaign", () => ({}));
jest.mock("../../services/CompanyService/VerifyCurrentSchedule", () =>
  jest.fn()
);
jest.mock("../../services/CounterServices/IncrementCounter", () => ({
  incrementCounter: jest.fn()
}));
jest.mock("../../services/CredentialServices/CredentialService", () => ({}));
jest.mock(
  "../../services/TicketServices/FindOrCreateATicketTrakingService",
  () => jest.fn()
);
jest.mock("../../services/TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: jest.fn(),
  websocketUpdateTicket: jest.fn()
}));
jest.mock("../../services/TranslationServices/i18nService", () => ({}));
jest.mock("../../services/WbotServices/SendWhatsAppMedia", () => ({}));
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: () => "000@s.whatsapp.net"
}));
jest.mock("../../services/WbotServices/verifyContact", () => ({
  verifyContact: jest.fn()
}));
jest.mock("../../services/WhatsappService/ShowWhatsAppService", () =>
  jest.fn()
);

const companyId = 10;
const contactId = 201;
const oldQueueId = 41;
const incomingQueueId = 42;
const whatsappId = 501;
const otherWhatsappId = 502;
const oldOwnerId = 101;
const newOwnerId = 102;
const queue = {
  id: incomingQueueId,
  companyId,
  name: "Fila ficticia",
  greetingMessage: "Saudacao ficticia do canal recebido",
  mediaPath: null,
  options: []
};
const socket = {
  id: whatsappId,
  sendMessage: jest.fn().mockResolvedValue({
    key: { id: "greeting-fixture", fromMe: true },
    message: { conversation: queue.greetingMessage }
  })
} as unknown as Session;

type FixtureRow = Record<string, unknown> & {
  update: jest.Mock;
  reload: jest.Mock;
  increment: jest.Mock;
};

const row = (fields: Record<string, unknown>): FixtureRow => {
  const record = {
    ...fields,
    update: jest.fn(async patch => Object.assign(record, patch)),
    reload: jest.fn(async () => record),
    increment: jest.fn(async name => {
      record[name] = Number(record[name] || 0) + 1;
      return record;
    })
  };
  return record;
};

const subscriber = (userId: number, queueId: number) => {
  const rooms = new Set(["301", `queue-${queueId}-notification`]);
  return {
    rooms,
    data: { contextActor: { userId, companyId } },
    emit: jest.fn(),
    leave: jest.fn(async room => rooms.delete(room))
  };
};

const receive = (quotedId?: string) =>
  handleMessage(
    {
      key: { id: "inbound-fixture", remoteJid: "000@s.whatsapp.net" },
      message: quotedId
        ? {
            extendedTextMessage: {
              text: "Mensagem ficticia",
              contextInfo: {
                stanzaId: quotedId,
                participant: "000@s.whatsapp.net",
                quotedMessage: { conversation: "Citacao ficticia" }
              }
            }
          }
        : { conversation: "Mensagem ficticia" }
    },
    socket,
    companyId
  );

let tickets: FixtureRow[];
let messages: Map<string, FixtureRow>;
let contact: FixtureRow;
let oldSubscriber: ReturnType<typeof subscriber>;
let newSubscriber: ReturnType<typeof subscriber>;

const expectInboundPublishedAfterTicketUpdate = () => {
  const inboundPublish = newSubscriber.emit.mock.calls.findIndex(
    ([, payload]) => payload.message?.id === "inbound-fixture"
  );
  expect(inboundPublish).toBeGreaterThanOrEqual(0);
  expect(
    newSubscriber.emit.mock.invocationCallOrder[inboundPublish]
  ).toBeGreaterThan(
    (UpdateTicketService as jest.Mock).mock.invocationCallOrder[0]
  );
};

const ticketFixture = (fields: Record<string, unknown> = {}) =>
  row({
    id: 301,
    contactId,
    companyId,
    queueId: oldQueueId,
    status: "open",
    channel: "whatsapp",
    userId: oldOwnerId,
    whatsappId,
    chatbot: true,
    queueOptionId: 99,
    ...fields
  });

beforeEach(() => {
  (checkCompanyCompliant as jest.Mock).mockResolvedValue(true);
  contact = row({ id: contactId, companyId, disableBot: false });
  const otherChannel = ticketFixture({ id: 302, whatsappId: otherWhatsappId });
  tickets = [ticketFixture(), otherChannel];
  messages = new Map([
    ["historical-fixture", row({ ticketId: 301, queueId: oldQueueId })]
  ]);
  oldSubscriber = subscriber(oldOwnerId, oldQueueId);
  newSubscriber = subscriber(newOwnerId, incomingQueueId);

  const viewers = [oldSubscriber, newSubscriber];
  const io = {
    in: (rooms: string | string[]) => ({
      fetchSockets: async () =>
        viewers.filter(viewer =>
          [rooms].flat().some(room => viewer.rooms.has(room))
        )
    }),
    to: () => ({ emit: jest.fn() })
  };
  (getIO as jest.Mock).mockReturnValue(io);
  (GetTicketWbot as jest.Mock).mockResolvedValue(socket);
  (websocketUpdateTicket as jest.Mock).mockImplementation(async ticket => {
    await revokeTicketContextRooms(getIO(), ticket.id);
  });
  (GetCompanySetting as jest.Mock).mockImplementation(
    async (_, key, fallback) => (key === "autoReopenTimeout" ? "10" : fallback)
  );
  (verifyContact as jest.Mock).mockResolvedValue(contact);
  (Contact.findOne as jest.Mock).mockResolvedValue(contact);
  (ShowWhatsAppService as jest.Mock).mockResolvedValue({
    id: whatsappId,
    companyId,
    queues: [queue]
  });
  (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: whatsappId });
  (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
    where.companyId === companyId
      ? {
          id: where.id,
          companyId,
          profile: "user",
          queues: [
            {
              id: where.id === oldOwnerId ? oldQueueId : incomingQueueId,
              companyId
            }
          ]
        }
      : null
  );
  (Ticket.findOne as jest.Mock).mockImplementation(
    async ({ where, include }) => {
      const ticket = tickets.find(candidate =>
        Object.entries(where).every(([name, value]) =>
          name === "status" && value?.[Op.or]
            ? value[Op.or].includes(candidate.status)
            : name === "updatedAt" || candidate[name] === value
        )
      );
      if (ticket && include) {
        Object.assign(ticket, {
          contact,
          queue: ticket.queueId ? { id: ticket.queueId } : null,
          user: ticket.userId ? { id: ticket.userId, socketSessions: [] } : null
        });
      }
      return ticket;
    }
  );
  (Ticket.create as jest.Mock).mockImplementation(async data => {
    const ticket = ticketFixture({ id: 303, ...data });
    tickets.push(ticket);
    return ticket;
  });
  (Message.upsert as jest.Mock).mockImplementation(async data => {
    const ticket = tickets.find(candidate => candidate.id === data.ticketId);
    messages.set(data.id, row({ queueId: null, ...data, ticket }));
  });
  (Message.findOne as jest.Mock).mockImplementation(async ({ where }) => {
    const ids =
      typeof where.id === "string" ? [where.id] : where.id?.[Op.or] || [];
    return ids
      .map(id => messages.get(id))
      .find(
        message =>
          message &&
          (where.companyId === undefined ||
            where.companyId === message.companyId) &&
          (where.ticketId === undefined || where.ticketId === message.ticketId)
      );
  });
  (Message.findAll as jest.Mock).mockImplementation(async ({ where }) => {
    const message = messages.get(where.id);
    return message && message.companyId === where.companyId ? [message] : [];
  });
  (UpdateTicketService as jest.Mock).mockImplementation(
    async ({ ticketId, ticketData }) => {
      const ticket = tickets.find(candidate => candidate.id === ticketId);
      await ticket.update(ticketData);
      ticket.queue = ticket.queueId ? { id: ticket.queueId } : null;
      return { ticket };
    }
  );
});

it.each(["open", "closed"])(
  "routes a new inbound message on a legacy %s ticket before persistence",
  async status => {
    tickets[0].status = status;
    await receive();

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      queueId: incomingQueueId
    });
    expect(messages.get("historical-fixture")).toMatchObject({
      queueId: oldQueueId
    });
    expect(tickets[0]).toMatchObject({
      id: 301,
      whatsappId,
      queueId: incomingQueueId,
      userId: null,
      status: "pending",
      queueOptionId: null
    });
    expect(tickets[1]).toMatchObject({
      id: 302,
      whatsappId: otherWhatsappId,
      queueId: oldQueueId
    });
    expect(Ticket.create).not.toHaveBeenCalled();
    expect(oldSubscriber.leave).toHaveBeenCalledWith("301");
    expect(oldSubscriber.emit).not.toHaveBeenCalled();
    expect(newSubscriber.emit).toHaveBeenCalledWith(
      `company-${companyId}-appMessage`,
      expect.objectContaining({
        message: expect.objectContaining({ id: "inbound-fixture" })
      })
    );
  }
);

it("keeps a correctly routed active ticket and its authorized owner", async () => {
  Object.assign(tickets[0], {
    queueId: incomingQueueId,
    userId: newOwnerId,
    chatbot: false,
    queueOptionId: null
  });
  await receive();

  expect(messages.get("inbound-fixture")).toMatchObject({
    ticketId: 301,
    queueId: incomingQueueId
  });
  expect(tickets[0]).toMatchObject({
    status: "open",
    userId: newOwnerId,
    whatsappId
  });
  expect(websocketUpdateTicket).not.toHaveBeenCalled();
  expect(socket.sendMessage).not.toHaveBeenCalled();
});

it("keeps an authorized owner and active status when repairing the legacy queue", async () => {
  tickets[0].userId = newOwnerId;
  await receive();

  expect(tickets[0]).toMatchObject({
    status: "open",
    userId: newOwnerId,
    queueId: incomingQueueId,
    queueOptionId: null,
    chatbot: false,
    whatsappId
  });
  expect(socket.sendMessage).not.toHaveBeenCalled();
});

it.each([
  { queues: [], menus: 0 },
  { queues: [queue, { ...queue, id: 43, name: "Outra fila" }], menus: 1 }
])(
  "clears an invalid route without guessing when there is no unique linked queue",
  async ({ queues, menus }) => {
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      id: whatsappId,
      companyId,
      greetingMessage: "Escolha uma fila",
      queues
    });
    await receive();

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      queueId: null
    });
    expect(tickets[0]).toMatchObject({
      status: "pending",
      queueId: null,
      userId: null,
      queueOptionId: null,
      whatsappId
    });
    expect(socket.sendMessage).toHaveBeenCalledTimes(menus);
    expect(oldSubscriber.leave).toHaveBeenCalledWith("301");
  }
);

it("stores the first inbound message in the only linked queue and starts its greeting", async () => {
  tickets = [tickets[1]];
  await receive();

  expect(messages.get("inbound-fixture")).toMatchObject({
    ticketId: 303,
    queueId: incomingQueueId
  });
  expect(tickets[1]).toMatchObject({
    id: 303,
    queueId: incomingQueueId,
    whatsappId
  });
  expect(socket.sendMessage).toHaveBeenCalledTimes(1);
  expect(socket.sendMessage).toHaveBeenCalledWith("000@s.whatsapp.net", {
    text: queue.greetingMessage
  });
  expectInboundPublishedAfterTicketUpdate();
});

it("stores the first inbound message without sending an hours reply for an unpaid company", async () => {
  tickets = [tickets[1]];
  (checkCompanyCompliant as jest.Mock).mockResolvedValue(false);
  (GetCompanySetting as jest.Mock).mockImplementation(
    async (_, key, fallback) => (key === "scheduleType" ? "queue" : fallback)
  );
  (VerifyCurrentSchedule as jest.Mock).mockResolvedValue({ inActivity: false });
  const findQueue = jest.spyOn(Queue, "findOne").mockResolvedValue({
    ...queue,
    outOfHoursMessage: "Fora do expediente ficticio"
  } as unknown as Queue);

  jest.useFakeTimers();
  try {
    await receive();

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 303,
      queueId: incomingQueueId
    });
    expect(socket.sendMessage).not.toHaveBeenCalled();
    expect(VerifyCurrentSchedule).not.toHaveBeenCalled();
  } finally {
    findQueue.mockRestore();
    jest.useRealTimers();
  }
});

it("publishes the assigned first inbound message after handling company hours", async () => {
  tickets = [tickets[1]];
  (GetCompanySetting as jest.Mock).mockImplementation(
    async (_, key, fallback) => (key === "scheduleType" ? "company" : fallback)
  );
  (VerifyCurrentSchedule as jest.Mock).mockResolvedValue({ inActivity: false });
  (ShowWhatsAppService as jest.Mock).mockResolvedValue({
    id: whatsappId,
    companyId,
    queues: [queue],
    outOfHoursMessage: "Fora do expediente ficticio"
  });
  const findQueue = jest
    .spyOn(Queue, "findByPk")
    .mockResolvedValue(queue as unknown as Queue);

  jest.useFakeTimers();
  try {
    await receive();

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 303,
      queueId: incomingQueueId
    });
    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    expect(socket.sendMessage).toHaveBeenCalledWith("000@s.whatsapp.net", {
      text: "Fora do expediente ficticio"
    });
    expectInboundPublishedAfterTicketUpdate();
  } finally {
    findQueue.mockRestore();
    jest.useRealTimers();
  }
});

it("does not hand a routed inbound ticket to a wallet owner without a matching queue", async () => {
  tickets = [tickets[1]];
  contact.walletUserId = oldOwnerId;
  (GetCompanySetting as jest.Mock).mockImplementation(
    async (_, key, fallback) =>
      key === "walletAutoAssign" ? "enabled" : fallback
  );
  (User.findByPk as jest.Mock).mockResolvedValue({
    id: oldOwnerId,
    companyId,
    queues: []
  });
  (Whatsapp.findOne as jest.Mock).mockResolvedValue({
    id: whatsappId,
    queues: [queue]
  });
  await receive();

  expect(tickets[1]).toMatchObject({
    id: 303,
    queueId: incomingQueueId,
    whatsappId,
    userId: null
  });
  expect(messages.get("inbound-fixture")).toMatchObject({
    ticketId: 303,
    queueId: incomingQueueId
  });
});

describe("quoted inbound context", () => {
  const quoteId = "original-quote-fixture";

  beforeEach(() => {
    Object.assign(tickets[0], {
      queueId: incomingQueueId,
      userId: newOwnerId,
      chatbot: false,
      queueOptionId: null
    });
  });

  const storeOriginalQuote = (channelId: number, ticketId: number) => {
    const originalTicket = ticketFixture({
      id: ticketId,
      whatsappId: channelId,
      status: "closed"
    });
    tickets.push(originalTicket);
    const original = row({
      id: quoteId,
      ticketId,
      companyId,
      queueId: oldQueueId,
      ticket: originalTicket
    });
    messages.set(quoteId, original);
    return original;
  };

  it("references the original quote without copying its other queue's text into the current ticket", async () => {
    storeOriginalQuote(whatsappId, 304);
    await receive(quoteId);

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      quotedMsgId: quoteId
    });
    expect(messages.get(quoteId)).toMatchObject({
      ticketId: 304,
      queueId: oldQueueId
    });
    expect(messages.has(`${quoteId}-301`)).toBe(false);
  });

  it("omits a known quote from a different WhatsApp without copying it", async () => {
    storeOriginalQuote(otherWhatsappId, 304);
    await receive(quoteId);

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      quotedMsgId: undefined
    });
    expect(messages.has(`${quoteId}-301`)).toBe(false);
  });

  it("omits an ambiguous known original rather than selecting an arbitrary ticket", async () => {
    const original = storeOriginalQuote(whatsappId, 304);
    const duplicate = storeOriginalQuote(whatsappId, 305);
    (Message.findAll as jest.Mock).mockResolvedValueOnce([original, duplicate]);
    await receive(quoteId);

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      quotedMsgId: undefined
    });
    expect(messages.has(`${quoteId}-301`)).toBe(false);
  });

  it("keeps the quoted context for an original genuinely unknown to the company", async () => {
    await receive(quoteId);

    expect(messages.get("inbound-fixture")).toMatchObject({
      ticketId: 301,
      quotedMsgId: `${quoteId}-301`
    });
    expect(messages.get(`${quoteId}-301`)).toMatchObject({
      ticketId: 301,
      queueId: incomingQueueId
    });
  });
});
