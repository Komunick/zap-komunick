import { Request, Response } from "express";
import * as TicketController from "../../controllers/TicketController";
import AppError from "../../errors/AppError";
import AuthorizeTicketContextService, {
  loadTicketViewer
} from "../../services/TicketServices/AuthorizeTicketContextService";
import CreateTicketService from "../../services/TicketServices/CreateTicketService";
import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import DeleteTicketService from "../../services/TicketServices/DeleteTicketService";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";

jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  findByPk: jest.fn(),
  findAll: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Tag", () => ({}));
jest.mock("../../services/TicketServices/CreateTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/DeleteTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/ListTicketsService", () => jest.fn());
jest.mock("../../services/TicketServices/ShowTicketFromUUIDService", () =>
  jest.fn()
);
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/UpdateTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/ListTicketsServiceKanban", () =>
  jest.fn()
);
jest.mock("../../services/MessageServices/CreateTransferNoteService", () =>
  jest.fn()
);
jest.mock("../../services/TagServices/SyncTagsService", () => jest.fn());
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  emitTicketContext: jest.fn()
}));
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({
    __esModule: true,
    default: jest.fn(),
    loadTicketViewer: jest.fn()
  })
);

describe("ticket mutations cannot bypass context authorization", () => {
  const denied = new AppError("ERR_NO_PERMISSION", 403);
  let req: Request;
  let res: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    (AuthorizeTicketContextService as jest.Mock).mockRejectedValue(denied);
    req = {
      user: { id: "101", companyId: 10, profile: "user" },
      params: { ticketId: "301" },
      body: {}
    } as unknown as Request;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as Response;
  });

  it("denies a PUT before loading or mutating the ticket", async () => {
    await expect(TicketController.update(req, res)).rejects.toBe(denied);
    expect(Ticket.findByPk).not.toHaveBeenCalled();
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("denies removal before calling the deletion service", async () => {
    await expect(TicketController.remove(req, res)).rejects.toBe(denied);
    expect(DeleteTicketService).not.toHaveBeenCalled();
  });

  it("reports a denied bulk item without running its mutation", async () => {
    req.body = { action: "accept", ticketIds: [301] };
    (Ticket.findAll as jest.Mock).mockResolvedValue([
      { id: 301, status: "pending" }
    ]);
    await TicketController.bulk(req, res);
    expect(UpdateTicketService).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      done: [],
      failed: [{ id: 301, error: "ERR_NO_PERMISSION" }]
    });
  });

  it.each([
    { isAdmin: false, queueIds: [] },
    { isAdmin: false, queueIds: [402] }
  ])(
    "does not create a ticket outside the attendant sector: %o",
    async viewer => {
      (loadTicketViewer as jest.Mock).mockResolvedValue({
        companyId: 10,
        ...viewer
      });
      req.body = { contactId: 201, userId: 101, queueId: 401 };
      await expect(TicketController.store(req, res)).rejects.toMatchObject({
        statusCode: 403
      });
      expect(CreateTicketService).not.toHaveBeenCalled();
    }
  );

  it("does not create a ticket with a foreign contact even for an admin", async () => {
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      companyId: 10,
      isAdmin: true,
      queueIds: []
    });
    (Contact.findOne as jest.Mock).mockResolvedValue(null);
    (User.findOne as jest.Mock).mockResolvedValue({ id: 101 });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 401 });
    req.body = { contactId: 999, userId: 101, queueId: 401 };
    await expect(TicketController.store(req, res)).rejects.toMatchObject({
      statusCode: 403
    });
    expect(Contact.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 999, companyId: 10 } })
    );
    expect(CreateTicketService).not.toHaveBeenCalled();
  });
});
