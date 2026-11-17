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
import {
  assignGeneralTriageDestination,
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
