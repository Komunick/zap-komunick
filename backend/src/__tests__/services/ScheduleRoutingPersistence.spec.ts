import { Request, Response } from "express";
import { Op } from "sequelize";
import * as ScheduleController from "../../controllers/ScheduleController";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Schedule from "../../models/Schedule";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import CreateNextOccurrenceService from "../../services/ScheduleServices/CreateNextOccurrenceService";
import ShowService from "../../services/ScheduleServices/ShowService";
import { loadTicketViewer } from "../../services/TicketServices/AuthorizeTicketContextService";

jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: jest.fn().mockReturnThis(), emit: jest.fn() })
}));
jest.mock("../../helpers/saveMediaFile", () => jest.fn());
jest.mock("../../database", () => ({
  transaction: (run: (transaction: object) => unknown) => run({})
}));
jest.mock("../../models/Contact", () => ({
  findAll: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/ContactTag", () => ({}));
jest.mock("../../models/Tag", () => ({}));
jest.mock("../../models/Queue", () => ({
  findAll: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({ findOne: jest.fn() }));
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Schedule", () => ({
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../services/ScheduleServices/ShowService", () => jest.fn());
jest.mock("../../services/ScheduleServices/ListService", () => jest.fn());
jest.mock("../../services/ScheduleServices/DeleteService", () => jest.fn());
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({
    loadTicketViewer: jest.fn()
  })
);

const companyId = 10;
const otherCompany = 20;
const userId = 11;
const contacts = [
  { id: 101, companyId },
  { id: 102, companyId },
  { id: 201, companyId: otherCompany }
];
const queues = [
  { id: 31, companyId },
  { id: 32, companyId },
  { id: 41, companyId: otherCompany }
];
const tickets = [
  {
    id: 61,
    companyId,
    contactId: 101,
    queueId: 31,
    whatsappId: 51,
    channel: "whatsapp"
  },
  {
    id: 62,
    companyId,
    contactId: 101,
    queueId: null,
    whatsappId: 52,
    channel: "whatsapp"
  },
  {
    id: 63,
    companyId,
    contactId: 101,
    queueId: 31,
    whatsappId: 53,
    channel: "instagram"
  },
  {
    id: 71,
    companyId: otherCompany,
    contactId: 201,
    queueId: 41,
    whatsappId: 54,
    channel: "whatsapp"
  }
];

const payload = {
  body: "Mensagem de teste",
  sendAt: "2026-11-10T14:30:00-03:00",
  contactId: 101
};
const stored = {
  id: 1,
  companyId,
  userId,
  contactId: 101,
  ticketId: 61,
  queueId: 31,
  routingMode: "ticket_queue",
  sendAt: new Date(payload.sendAt),
  recurrence: "daily",
  recurrenceAnchorAt: new Date(payload.sendAt),
  update: jest.fn(),
  reload: jest.fn()
};

const matches = (row: object, where: object) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

function request(body: object, profile = "user"): Request {
  return {
    body,
    params: { scheduleId: "1" },
    user: { id: String(userId), companyId, profile }
  } as unknown as Request;
}

function update(data: object, res: Response, isAdmin = true) {
  (loadTicketViewer as jest.Mock).mockResolvedValueOnce({
    isAdmin,
    companyId,
    queueIds: [31]
  });
  return ScheduleController.update(request(data, "admin"), res);
}

describe("schedule route persistence through the HTTP controller", () => {
  let res: Response;
  let inserted: object[];

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as Response;
    inserted = [];
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      isAdmin: false,
      companyId,
      queueIds: [31]
    });
    (Contact.findAll as jest.Mock).mockImplementation(async ({ where }) =>
      contacts.filter(
        contact =>
          contact.companyId === where.companyId &&
          where.id[Op.in].includes(contact.id)
      )
    );
    (Contact.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      contacts.find(contact => matches(contact, where))
    );
    (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      matches({ id: userId, companyId }, where) ? { id: userId } : null
    );
    (Queue.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      queues.find(queue => matches(queue, where))
    );
    (Queue.findAll as jest.Mock).mockImplementation(async ({ where }) =>
      queues.filter(queue => matches(queue, where))
    );
    (Ticket.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      tickets.find(ticket => matches(ticket, where))
    );
    (Schedule.bulkCreate as jest.Mock).mockImplementation(async rows => {
      inserted = rows.map((row, index) => ({ ...row, id: index + 1 }));
      return inserted;
    });
    (Schedule.findAll as jest.Mock).mockImplementation(async () => inserted);
    (ShowService as jest.Mock).mockResolvedValue({ ...stored });
  });

  it("persists the authorized queue in a standalone schedule", async () => {
    await ScheduleController.store(request({ ...payload, queueId: "31" }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ queueId: 31, routingMode: "queue" })
    );
  });

  it("uses the actor's only queue for every allowed recipient", async () => {
    await ScheduleController.store(
      request({ ...payload, contactIds: [101, 102, 201] }),
      res
    );

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ contactId: 101, queueId: 31 }),
      expect.objectContaining({ contactId: 102, queueId: 31 })
    ]);
  });

  it("requires an explicit queue for an admin who can reach multiple queues", async () => {
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      isAdmin: true,
      companyId,
      queueIds: [31]
    });
    await expect(
      ScheduleController.store(request(payload, "admin"), res)
    ).rejects.toMatchObject({ message: "ERR_SCHEDULE_QUEUE_REQUIRED" });
    expect(Schedule.bulkCreate).not.toHaveBeenCalled();
  });

  it("allows a genuinely queue-less company", async () => {
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      isAdmin: false,
      companyId,
      queueIds: []
    });
    (Queue.findAll as jest.Mock).mockResolvedValue([]);
    await ScheduleController.store(request(payload), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ queueId: null, routingMode: null })
    );
  });

  it.each([32, 41])("rejects a forbidden queue %i", async queueId => {
    await expect(
      ScheduleController.store(request({ ...payload, queueId }), res)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Schedule.bulkCreate).not.toHaveBeenCalled();
  });

  it("derives and persists ticket and queue for its exact contact", async () => {
    await ScheduleController.store(
      request({ ...payload, ticketId: "61" }),
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 101,
        ticketId: 61,
        queueId: 31,
        routingMode: "ticket_queue"
      })
    );
  });

  it("retains an exact unqueued ticket route for an authorized admin", async () => {
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      isAdmin: true,
      companyId,
      queueIds: []
    });
    await ScheduleController.store(
      request({ ...payload, ticketId: 62 }, "admin"),
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 62,
        queueId: null,
        routingMode: "ticket"
      })
    );
  });

  it.each([
    { ticketId: 63 },
    { ticketId: 71 },
    { ticketId: 61, contactId: 0 },
    { ticketId: 61, contactId: 102 },
    { ticketId: 61, contactId: 102, contactIds: [101] },
    { ticketId: 61, contactIds: [101, 102] },
    { ticketId: 61, tagId: 1 },
    { ticketId: 61, queueId: 32 }
  ])("rejects invalid ticket schedule context %o", async override => {
    await expect(
      ScheduleController.store(request({ ...payload, ...override }), res)
    ).rejects.toMatchObject({ message: "ERR_SCHEDULE_TICKET_CONTEXT" });
    expect(Schedule.bulkCreate).not.toHaveBeenCalled();
  });

  it("allows a body edit while preserving the linked sender", async () => {
    await update({ body: "Texto novo de teste", ticketId: "61" }, res);

    expect(stored.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Texto novo de teste",
        contactId: 101,
        queueId: 31,
        routingMode: "ticket_queue",
        recurrenceAnchorAt: stored.recurrenceAnchorAt
      })
    );
  });

  it.each([
    { ticketId: null },
    { ticketId: 62 },
    { contactId: 102 },
    { queueId: null }
  ])("rejects removal or reassignment of linked context %o", async data => {
    await expect(update(data, res)).rejects.toMatchObject({
      message: "ERR_SCHEDULE_TICKET_CONTEXT"
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("rejects a legacy cross-company owner before updating", async () => {
    await expect(update({ userId: 21 }, res)).rejects.toMatchObject({
      statusCode: 403
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("keeps a deleted ticket distinguishable from a standalone schedule", async () => {
    (ShowService as jest.Mock).mockResolvedValue({
      ...stored,
      ticketId: null
    });
    await expect(update({ body: "Texto novo" }, res)).rejects.toMatchObject({
      message: "ERR_SCHEDULE_TICKET_CONTEXT"
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("requires current admin authorization for edits", async () => {
    await expect(update({ queueId: 31 }, res, false)).rejects.toMatchObject({
      statusCode: 403
    });
    expect(ShowService).not.toHaveBeenCalled();
  });

  it("requires an explicit replacement if a standalone queue was deleted", async () => {
    (ShowService as jest.Mock).mockResolvedValue({
      ...stored,
      ticketId: null,
      queueId: null,
      routingMode: "queue"
    });
    await expect(update({ body: "Texto novo" }, res)).rejects.toMatchObject({
      message: "ERR_SCHEDULE_QUEUE_REQUIRED"
    });
    expect(stored.update).not.toHaveBeenCalled();
    await update({ queueId: 32 }, res);
    expect(stored.update).toHaveBeenCalledWith(
      expect.objectContaining({ queueId: 32, routingMode: "queue" })
    );
  });

  it("carries both references and the route mode into the next occurrence", async () => {
    (Schedule.create as jest.Mock).mockResolvedValue({
      companyId,
      reload: jest.fn()
    });
    await CreateNextOccurrenceService(
      stored as unknown as Schedule,
      new Date(payload.sendAt)
    );
    expect(Schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 61,
        queueId: 31,
        routingMode: "ticket_queue",
        sendAt: new Date("2026-11-11T14:30:00-03:00"),
        status: "PENDENTE"
      })
    );
  });
});
