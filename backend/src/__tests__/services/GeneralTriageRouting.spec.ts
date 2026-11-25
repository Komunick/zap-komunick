import { Op } from "sequelize";
import {
  readGeneralTriageQueueId,
  readGeneralTriageTimeout
} from "../../helpers/GeneralTriage";
import IsWhatsAppQueueLinked from "../../helpers/IsWhatsAppQueueLinked";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import Whatsapp from "../../models/Whatsapp";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { websocketUpdateTicket } from "../../services/TicketServices/UpdateTicketService";
import { cacheLayer } from "../../libs/cache";
import { removeTicketFromQueueLists } from "../../services/SocketServices/TicketContextSocketService";
import {
  assignGeneralTriageDestination,
  claimGeneralTriageMenu,
  startGeneralTriageWait
} from "../../services/WbotServices/GeneralTriageRouting";
import routeExpiredGeneralTriageTickets, {
  generalTriageLegacyExclusion
} from "../../services/WbotServices/RouteExpiredGeneralTriageTickets";

jest.mock("../../helpers/GeneralTriage", () => ({
  GENERAL_TRIAGE_QUEUE: "generalTriageQueueId",
  readGeneralTriageQueueId: jest.fn(),
  readGeneralTriageTimeout: jest.fn()
}));
jest.mock("../../helpers/IsWhatsAppQueueLinked", () => jest.fn());
jest.mock("../../libs/socket", () => ({ getIO: jest.fn(() => "io") }));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  removeTicketFromQueueLists: jest.fn()
}));
jest.mock("../../libs/cache", () => ({
  cacheLayer: { setIfAbsent: jest.fn() }
}));
jest.mock("../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));
jest.mock("../../models/Message", () => ({ update: jest.fn() }));
jest.mock("../../models/Setting", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  update: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  sequelize: {
    transaction: callback => callback({ LOCK: { UPDATE: "UPDATE" } })
  }
}));
jest.mock("../../models/TicketTraking", () => ({ update: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({ findAll: jest.fn() }));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/UpdateTicketService", () => ({
  websocketUpdateTicket: jest.fn()
}));

const ticket = { id: 31, companyId: 10, whatsappId: 101 } as Ticket;
const general = { id: 62, chatbot: false, isGeneral: true };
const now = new Date("2026-11-13T15:00:00Z");
const deadline = new Date("2026-11-13T14:45:00Z");
const firstInbound = new Date("2026-11-13T14:30:00Z");
const routed = { ...ticket, queueId: general.id };

beforeEach(() => {
  (readGeneralTriageQueueId as jest.Mock).mockResolvedValue(general.id);
  (readGeneralTriageTimeout as jest.Mock).mockResolvedValue(15);
  (IsWhatsAppQueueLinked as jest.Mock).mockResolvedValue(true);
  (Setting.findAll as jest.Mock).mockResolvedValue([
    { companyId: ticket.companyId }
  ]);
  (Whatsapp.findAll as jest.Mock).mockResolvedValue([
    { id: ticket.whatsappId }
  ]);
  (Ticket.findAll as jest.Mock).mockResolvedValue([ticket]);
  (Ticket.findOne as jest.Mock).mockResolvedValue({
    id: ticket.id,
    generalTriageStartedAt: firstInbound,
    unansweredSince: firstInbound
  });
  (Ticket.update as jest.Mock).mockResolvedValue([1]);
  (ShowTicketService as jest.Mock).mockResolvedValue(routed);
});

it("starts the timer without resetting the original wait or updating an assigned ticket", async () => {
  await expect(startGeneralTriageWait(ticket, false)).resolves.toBe(true);
  expect(Ticket.update).toHaveBeenCalledWith(
    { chatbot: false, generalTriageStartedAt: expect.any(Object) },
    {
      where: {
        ...ticket,
        status: "pending",
        channel: "whatsapp",
        isGroup: false,
        queueId: null,
        userId: null
      }
    }
  );
});

it("moves only expired unassigned tickets on a linked channel and keeps the messages unread", async () => {
  await expect(
    routeExpiredGeneralTriageTickets({ companyId: ticket.companyId, now })
  ).resolves.toBe(1);
  expect(Setting.findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ companyId: ticket.companyId })
    })
  );
  expect(Ticket.findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        companyId: ticket.companyId,
        whatsappId: [ticket.whatsappId],
        generalTriageStartedAt: { [Op.lte]: deadline }
      })
    })
  );
  expect(Ticket.update).toHaveBeenCalledWith(
    {
      queueId: general.id,
      chatbot: false,
      queueOptionId: null,
      generalTriageStartedAt: null
    },
    {
      where: {
        ...ticket,
        status: "pending",
        channel: "whatsapp",
        isGroup: false,
        userId: null,
        queueId: null,
        generalTriageStartedAt: { [Op.lte]: deadline }
      },
      transaction: expect.any(Object)
    }
  );
  expect(Message.update).toHaveBeenCalledWith(
    { queueId: general.id },
    {
      where: {
        ticketId: ticket.id,
        companyId: ticket.companyId,
        channel: "whatsapp",
        fromMe: false,
        queueId: null,
        createdAt: { [Op.gte]: firstInbound },
        id: { [Op.notLike]: `%-${ticket.id}` }
      },
      transaction: expect.any(Object)
    }
  );
  expect(TicketTraking.update).toHaveBeenCalled();
  expect(websocketUpdateTicket).toHaveBeenCalledWith(routed);
});

it("does not move a concurrently claimed ticket or its messages", async () => {
  (Ticket.findOne as jest.Mock).mockResolvedValue(null);
  await expect(
    assignGeneralTriageDestination(ticket, general, deadline)
  ).resolves.toBeNull();
  expect(Ticket.update).not.toHaveBeenCalled();
  expect(Message.update).not.toHaveBeenCalled();
  expect(websocketUpdateTicket).not.toHaveBeenCalled();
});

it("refuses a removed channel link and ignores an old configuration", async () => {
  (IsWhatsAppQueueLinked as jest.Mock).mockResolvedValueOnce(false);
  await expect(
    assignGeneralTriageDestination(ticket, general, deadline)
  ).resolves.toBeNull();
  (readGeneralTriageQueueId as jest.Mock).mockResolvedValue(63);
  await expect(
    assignGeneralTriageDestination(ticket, general, deadline)
  ).resolves.toBeNull();
  expect(Ticket.update).not.toHaveBeenCalled();
});

it("leaves the legacy timeout unrestricted unless a configured channel is linked", async () => {
  (Whatsapp.findAll as jest.Mock).mockResolvedValueOnce([]);
  await expect(generalTriageLegacyExclusion(ticket.companyId)).resolves.toEqual(
    {}
  );
  const condition = await generalTriageLegacyExclusion(ticket.companyId);
  expect(condition[Op.or]).toEqual(
    expect.arrayContaining([
      { generalTriageStartedAt: null },
      { whatsappId: { [Op.notIn]: [ticket.whatsappId] } }
    ])
  );
});

describe("sector menu sent once per wait", () => {
  const setIfAbsent = (cacheLayer as unknown as { setIfAbsent: jest.Mock })
    .setIfAbsent;

  it("claims the menu per ticket for as long as the configured wait", async () => {
    setIfAbsent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(claimGeneralTriageMenu(ticket)).resolves.toBe(true);
    await expect(claimGeneralTriageMenu(ticket)).resolves.toBe(false);

    expect(setIfAbsent).toHaveBeenNthCalledWith(
      1,
      `general-triage-menu:${ticket.companyId}:${ticket.id}`,
      "1",
      15 * 60
    );
  });

  it("keeps at least one minute when the wait is shorter", async () => {
    (readGeneralTriageTimeout as jest.Mock).mockResolvedValueOnce(0);
    setIfAbsent.mockResolvedValueOnce(true);

    await claimGeneralTriageMenu(ticket);

    expect(setIfAbsent).toHaveBeenLastCalledWith(expect.any(String), "1", 60);
  });

  it("still sends the menu when the cache is unavailable", async () => {
    setIfAbsent.mockRejectedValueOnce(new Error("redis down"));

    await expect(claimGeneralTriageMenu(ticket)).resolves.toBe(true);
  });
});

// Zap Komunick (RF-033): while it waited, the conversation was on the lists of
// the general queue.
describe("leaving the wait", () => {
  it("takes the conversation off the lists of the general queue when the customer picks another sector", async () => {
    await assignGeneralTriageDestination(ticket, {
      id: 63,
      chatbot: false,
      isGeneral: false
    });

    expect(removeTicketFromQueueLists).toHaveBeenCalledWith(
      "io",
      routed,
      general.id
    );
    // the removal goes first: whoever is also of the new sector gets it back
    expect(
      (removeTicketFromQueueLists as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
      (websocketUpdateTicket as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("leaves the lists alone when the conversation goes to the general queue itself", async () => {
    (removeTicketFromQueueLists as jest.Mock).mockClear();
    await assignGeneralTriageDestination(ticket, general);
    expect(removeTicketFromQueueLists).not.toHaveBeenCalled();
    expect(websocketUpdateTicket).toHaveBeenCalledWith(routed);
  });

  it("still delivers the update when the lists cannot be corrected", async () => {
    (removeTicketFromQueueLists as jest.Mock).mockRejectedValueOnce(
      new Error("socket down")
    );
    (websocketUpdateTicket as jest.Mock).mockClear();
    await expect(
      assignGeneralTriageDestination(ticket, {
        id: 63,
        chatbot: false,
        isGeneral: false
      })
    ).resolves.toBe(routed);
    expect(websocketUpdateTicket).toHaveBeenCalledWith(routed);
  });
});
