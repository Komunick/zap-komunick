import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import User from "../../models/User";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";
import { loadTicketViewer } from "../../services/TicketServices/AuthorizeTicketContextService";
import { assignGeneralTriageDestination } from "../../services/WbotServices/GeneralTriageRouting";
import {
  loadGeneralTriageScope,
  loadMemberGeneralTriageScope
} from "../../helpers/GeneralTriage";
import { removeTicketFromQueueLists } from "../../services/SocketServices/TicketContextSocketService";

jest.mock("../../helpers/CheckContactOpenTickets", () => jest.fn());
jest.mock("../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: jest.fn().mockReturnThis(), emit: jest.fn() })
}));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Queue", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock(
  "../../services/TicketServices/FindOrCreateATicketTrakingService",
  () => jest.fn()
);
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/IsWhatsAppQueueLinked", () =>
  jest.fn().mockResolvedValue(true)
);
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  startQueue: jest.fn(),
  verifyMessage: jest.fn()
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../helpers/Mustache", () => jest.fn());
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn() }
}));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  emitTicketContext: jest.fn(),
  invalidateTicketNotifications: jest.fn(),
  removeTicketFromQueueLists: jest.fn(),
  revokeTicketContextRooms: jest.fn()
}));
jest.mock("../../services/CounterServices/IncrementCounter", () => ({
  incrementCounter: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../services/TranslationServices/i18nService", () => ({
  _t: jest.fn()
}));
jest.mock("../../services/CloseReasonServices/CloseReasonService", () => ({
  ActiveCloseReasonIds: jest.fn()
}));
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({ __esModule: true, default: jest.fn(), loadTicketViewer: jest.fn() })
);
jest.mock("../../services/WbotServices/GeneralTriageRouting", () => ({
  assignGeneralTriageDestination: jest.fn()
}));
jest.mock("../../helpers/GeneralTriage", () => ({
  ...jest.requireActual("../../helpers/GeneralTriage"),
  loadGeneralTriageScope: jest.fn(),
  loadMemberGeneralTriageScope: jest.fn()
}));

const GENERAL = 7;
const scope = { queueId: GENERAL, whatsappIds: [2] };

// What the ticket looks like in the database, and the instance the service
// works on (ShowTicketService result).
let row: Record<string, unknown>;
const update = jest.fn();
const reload = jest.fn();

const waitingRow = () => ({
  id: 301,
  companyId: 10,
  contactId: 501,
  status: "pending",
  channel: "whatsapp",
  isGroup: false,
  queueId: null,
  userId: null,
  whatsappId: 2,
  chatbot: true,
  generalTriageStartedAt: new Date("2026-11-25T14:11:00Z"),
  contact: { disableBot: true, isGroup: false }
});

const actingAs = (profile: string, queueIds: number[]) => {
  (User.findByPk as jest.Mock).mockResolvedValue({
    id: 101,
    companyId: 10,
    profile
  });
  (User.findOne as jest.Mock).mockResolvedValue({ id: 101 });
  (loadTicketViewer as jest.Mock).mockResolvedValue({
    companyId: 10,
    isAdmin: profile === "admin",
    queueIds
  });
  (loadMemberGeneralTriageScope as jest.Mock).mockResolvedValue(
    queueIds.includes(GENERAL) ? scope : null
  );
};

const accept = () =>
  UpdateTicketService({
    ticketId: 301,
    reqUserId: 101,
    ticketData: { status: "open", userId: 101, onlyIfPending: true }
  });

beforeEach(() => {
  jest.clearAllMocks();
  row = waitingRow();
  update.mockImplementation(async changes => {
    Object.entries(changes).forEach(([key, value]) => {
      if (value !== undefined) row[key] = value;
    });
  });
  (ShowTicketService as jest.Mock).mockImplementation(async () => {
    const ticket = row as Record<string, unknown>;
    ticket.update = update;
    ticket.reload = reload;
    ticket.user = undefined;
    return ticket;
  });
  (GetCompanySetting as jest.Mock).mockResolvedValue("disabled");
  (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
    startedAt: null,
    save: jest.fn(),
    update: jest.fn()
  });
  (loadGeneralTriageScope as jest.Mock).mockResolvedValue(scope);
  // routing to the general queue is what the worker does at the end of the wait
  (assignGeneralTriageDestination as jest.Mock).mockImplementation(async () => {
    row.queueId = GENERAL;
    row.chatbot = false;
    row.generalTriageStartedAt = null;
    return row;
  });
});

describe("an attendant of the general queue accepts a conversation waiting for a sector", () => {
  it("takes it into the general queue first and then accepts it", async () => {
    actingAs("user", [GENERAL, 8]);

    await accept();

    expect(assignGeneralTriageDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: 301 }),
      { id: GENERAL, chatbot: false, isGeneral: true }
    );
    expect(reload).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", userId: 101 })
    );
    // the ticket ends in the general queue, with the attendant, out of the wait
    expect(row).toMatchObject({
      queueId: GENERAL,
      userId: 101,
      status: "open",
      generalTriageStartedAt: null
    });
    // it moved to the queue its viewers are in: nothing to take off their lists
    expect(removeTicketFromQueueLists).not.toHaveBeenCalled();
  });

  it("is refused to an attendant who is not of the general queue", async () => {
    actingAs("user", [8]);

    await expect(accept()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(row).toMatchObject({
      queueId: null,
      userId: null,
      status: "pending"
    });
  });

  it("is refused when the ticket left the wait in the meantime", async () => {
    actingAs("user", [GENERAL]);
    // the customer picked a sector a moment before the click
    (assignGeneralTriageDestination as jest.Mock).mockResolvedValue(null);

    await expect(accept()).rejects.toMatchObject({ statusCode: 403 });
    expect(update).not.toHaveBeenCalled();
  });

  it("stays refused for a ticket without sector that is not waiting", async () => {
    actingAs("user", [GENERAL]);
    row.generalTriageStartedAt = null;

    await expect(accept()).rejects.toMatchObject({ statusCode: 403 });
    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
    expect(loadMemberGeneralTriageScope).not.toHaveBeenCalled();
  });

  it("stays refused when the ticket is of a connection outside the general queue", async () => {
    actingAs("user", [GENERAL]);
    row.whatsappId = 9;

    await expect(accept()).rejects.toMatchObject({ statusCode: 403 });
    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
  });
});

describe("an administrator and a conversation waiting for a sector", () => {
  it("accepts as before, and the ticket leaves the lists of the general queue", async () => {
    actingAs("admin", []);

    await accept();

    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
    expect(row).toMatchObject({
      queueId: null,
      userId: 101,
      status: "open",
      generalTriageStartedAt: null
    });
    // the attendants of the general queue were seeing it: it is taken out
    expect(removeTicketFromQueueLists).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 301 }),
      GENERAL
    );
  });

  it("does not touch the lists of a ticket that was not waiting", async () => {
    actingAs("admin", []);
    row.generalTriageStartedAt = null;

    await accept();

    expect(loadGeneralTriageScope).not.toHaveBeenCalled();
    expect(removeTicketFromQueueLists).not.toHaveBeenCalled();
  });
});

// A close goes by who is closing: the ticket must not end up closed without a
// sector in the hands of someone who cannot see tickets without a sector.
describe("closing a conversation that waits for a sector", () => {
  beforeEach(() => {
    // every setting at its default (a closed ticket keeps its sector and its
    // attendant), and closing without a farewell message is allowed
    (GetCompanySetting as jest.Mock).mockImplementation(
      async (_company, key, fallback) =>
        key === "allowSilentlyClose" ? "enabled" : (fallback ?? "disabled")
    );
  });

  const close = () =>
    UpdateTicketService({
      ticketId: 301,
      reqUserId: 101,
      ticketData: { status: "closed", justClose: true, userId: 101 }
    });

  it("takes it into the general queue first when an attendant of that queue closes it", async () => {
    actingAs("user", [GENERAL]);

    await close();

    expect(assignGeneralTriageDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: 301 }),
      { id: GENERAL, chatbot: false, isGeneral: true }
    );
    expect(row).toMatchObject({ queueId: GENERAL, status: "closed" });
  });

  it("goes by the requester even when the request names nobody", async () => {
    actingAs("user", [GENERAL]);

    await UpdateTicketService({
      ticketId: 301,
      reqUserId: 101,
      ticketData: { status: "closed", justClose: true }
    });

    expect(loadTicketViewer).toHaveBeenCalledWith({
      userId: 101,
      companyId: 10
    });
    expect(row).toMatchObject({ queueId: GENERAL, status: "closed" });
  });

  it("leaves an administrator closing it as before", async () => {
    actingAs("admin", []);

    await close();

    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
    expect(row).toMatchObject({ queueId: null, status: "closed" });
    expect(removeTicketFromQueueLists).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 301 }),
      GENERAL
    );
  });
});

// The customer may pick a sector between the access check of the request and
// the update: the ticket read by the update is the one that counts.
describe("an accept that loses the race with the customer's choice", () => {
  it("is refused when the ticket is now of a sector the attendant is not in", async () => {
    actingAs("user", [GENERAL]);
    // by the time the update reads the ticket, it is already in sector 9
    row.queueId = 9;
    row.generalTriageStartedAt = null;
    row.chatbot = false;

    await expect(accept()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    expect(assignGeneralTriageDestination).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(row).toMatchObject({ queueId: 9, userId: null, status: "pending" });
  });

  it("goes through when the ticket is now of a sector the attendant is in", async () => {
    actingAs("user", [GENERAL, 9]);
    row.queueId = 9;
    row.generalTriageStartedAt = null;
    row.chatbot = false;

    await accept();

    expect(row).toMatchObject({ queueId: 9, userId: 101, status: "open" });
  });

  it("does not question an administrator, nor an accept that names its queue", async () => {
    actingAs("admin", []);
    row.queueId = 9;
    row.generalTriageStartedAt = null;
    await accept();
    expect(row).toMatchObject({ queueId: 9, userId: 101, status: "open" });
    // an administrator is never looked up as a member of anything
    expect(loadTicketViewer).not.toHaveBeenCalled();
  });
});
