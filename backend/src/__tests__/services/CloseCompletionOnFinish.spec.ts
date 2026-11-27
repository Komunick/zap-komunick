import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import ShowCloseCompletionService from "../../services/TicketServices/ShowCloseCompletionService";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
import User from "../../models/User";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import IsWhatsAppQueueLinked from "../../helpers/IsWhatsAppQueueLinked";
import formatBody from "../../helpers/Mustache";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";
import AuthorizeTicketContextService, {
  loadTicketViewer
} from "../../services/TicketServices/AuthorizeTicketContextService";
import { ActiveCloseReasonIds } from "../../services/CloseReasonServices/CloseReasonService";
import { verifyMessage } from "../../services/WbotServices/wbotMessageListener";

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
jest.mock("../../helpers/BindDefaultWhatsapp", () => jest.fn());
jest.mock("../../helpers/IsWhatsAppQueueLinked", () => jest.fn());
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  startQueue: jest.fn(),
  verifyMessage: jest.fn()
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
// the names are filled in by the real formatter in production; here it is
// enough to see that the text goes through it
jest.mock("../../helpers/Mustache", () =>
  jest.fn((text: string) => `[formatted] ${text}`)
);
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
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
  _t: jest.fn((text: string) => text)
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
  loadGeneralTriageScope: jest.fn().mockResolvedValue(null),
  loadMemberGeneralTriageScope: jest.fn().mockResolvedValue(null)
}));

const MESSAGE =
  "*Seu atendimento será finalizado.*\nSempre que precisar não hesite em nos contatar, será um prazer atendê-lo.";

let row: Record<string, unknown>;
let settings: Record<string, string>;
const send = SendWhatsAppMessage as jest.Mock;

const openRow = () => ({
  id: 301,
  companyId: 10,
  contactId: 501,
  status: "open",
  channel: "whatsapp",
  isGroup: false,
  queueId: 2,
  userId: 101,
  whatsappId: 2,
  chatbot: false,
  contact: { disableBot: false, isGroup: false },
  whatsapp: { status: "CONNECTED", complationMessage: MESSAGE }
});

beforeEach(() => {
  jest.clearAllMocks();
  row = openRow();
  settings = {};
  (ShowTicketService as jest.Mock).mockImplementation(async () => {
    const ticket = row;
    ticket.update = jest.fn(async (changes: Record<string, unknown>) => {
      Object.entries(changes).forEach(([key, value]) => {
        if (value !== undefined) row[key] = value;
      });
    });
    ticket.reload = jest.fn();
    return ticket;
  });
  (GetCompanySetting as jest.Mock).mockImplementation(
    async (_company, key, fallback) => settings[key] ?? fallback
  );
  (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
    startedAt: new Date(),
    save: jest.fn(),
    update: jest.fn()
  });
  (IsWhatsAppQueueLinked as jest.Mock).mockResolvedValue(true);
  (ActiveCloseReasonIds as jest.Mock).mockResolvedValue([]);
  (User.findByPk as jest.Mock).mockResolvedValue({
    id: 101,
    companyId: 10,
    profile: "user"
  });
  (User.findOne as jest.Mock).mockResolvedValue({ id: 101 });
  (loadTicketViewer as jest.Mock).mockResolvedValue({
    companyId: 10,
    isAdmin: false,
    queueIds: [2]
  });
  (AuthorizeTicketContextService as jest.Mock).mockResolvedValue({
    viewer: { isAdmin: false, queueIds: [2] }
  });
  send.mockResolvedValue({ key: { id: "sent" } });
});

const finish = (extra: Record<string, unknown> = {}) =>
  UpdateTicketService({
    ticketId: 301,
    reqUserId: 101,
    ticketData: { status: "closed", userId: 101, ...extra }
  });
const preview = () =>
  ShowCloseCompletionService("301", { userId: 101, companyId: 10 });

describe("finishing a ticket of an office that does NOT ask (how it always was)", () => {
  it("sends the completion message on every finish", async () => {
    await finish();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].body).toBe(`[formatted] ${MESSAGE}`);
    expect(verifyMessage).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("closed");
  });

  it("does not send it on a silent finish", async () => {
    await finish({ justClose: true });
    expect(send).not.toHaveBeenCalled();
    expect(row.status).toBe("closed");
  });

  it("has nothing to ask on the screen", async () => {
    await expect(preview()).resolves.toEqual({ ask: false, message: null });
  });

  // the window was open when the office turned the question off: the no of
  // who was asked is still a no
  it("respects an explicit no all the same", async () => {
    await finish({ sendCompletion: false });
    expect(send).not.toHaveBeenCalled();
    expect(row.status).toBe("closed");
  });

  it("sends it again on a repeated finish, exactly as before this option existed", async () => {
    row.status = "closed";
    await finish();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("finishing a ticket of an office that asks whoever finishes", () => {
  beforeEach(() => {
    settings.completionMessagePrompt = "enabled";
  });

  it("tells the screen to ask, with the text the client would receive", async () => {
    await expect(preview()).resolves.toEqual({
      ask: true,
      message: `[formatted] ${MESSAGE}`
    });
    expect(AuthorizeTicketContextService).toHaveBeenCalledWith("301", {
      userId: 101,
      companyId: 10
    });
  });

  it("sends the message when the person says yes", async () => {
    await finish({ sendCompletion: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].body).toBe(`[formatted] ${MESSAGE}`);
    expect(row.status).toBe("closed");
  });

  it("finishes without sending when the person says no", async () => {
    await finish({ sendCompletion: false });
    expect(send).not.toHaveBeenCalled();
    expect(row.status).toBe("closed");
  });

  // a screen opened before the option was turned on, the finish from the
  // list, a bulk action, an automation: none of them answers the question
  it.each([
    ["nothing", {}],
    ["a text instead of a yes", { sendCompletion: "true" }],
    ["a silent finish with a yes", { justClose: true, sendCompletion: true }]
  ])("does not send it to a request that says %s", async (_label, extra) => {
    await finish(extra);
    expect(send).not.toHaveBeenCalled();
    expect(row.status).toBe("closed");
  });

  it.each([
    ["a group", () => (row.isGroup = true)],
    [
      "a client who turned the robot off",
      () => ((row.contact as { disableBot: boolean }).disableBot = true)
    ],
    [
      "a connection that is down",
      () => ((row.whatsapp as { status: string }).status = "DISCONNECTED")
    ],
    [
      "a connection without the message",
      () =>
        ((row.whatsapp as { complationMessage: string }).complationMessage =
          "  ")
    ],
    ["another channel", () => (row.channel = "facebook")],
    [
      "a sector that does not answer through this connection",
      () => (IsWhatsAppQueueLinked as jest.Mock).mockResolvedValue(false)
    ],
    ["a ticket already finished", () => (row.status = "closed")]
  ])(
    "does not ask for %s; a yes that cannot be honoured finishes nothing and says so",
    async (_label, change) => {
      change();
      const before = row.status;
      await expect(preview()).resolves.toEqual({ ask: false, message: null });
      await expect(finish({ sendCompletion: true })).rejects.toMatchObject({
        message: "ERR_COMPLETION_NOT_SENT",
        statusCode: 409
      });
      expect(send).not.toHaveBeenCalled();
      expect(row.status).toBe(before);
      // and the person can still finish without the message
      if (before !== "closed") {
        await finish({ sendCompletion: false });
        expect(send).not.toHaveBeenCalled();
        expect(row.status).toBe("closed");
      }
    }
  );

  // finished in another tab, or a retry after an answer that got lost: the
  // client does not receive the message a second time
  it("does not send the message again to a ticket that was already finished", async () => {
    await finish({ sendCompletion: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("closed");
    await expect(finish({ sendCompletion: true })).rejects.toMatchObject({
      message: "ERR_COMPLETION_NOT_SENT",
      statusCode: 409
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not block the Finish button when the text of the connection has a broken tag", async () => {
    (formatBody as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Unclosed tag at 20");
    });
    await expect(preview()).resolves.toEqual({ ask: false, message: null });
  });

  // With ratings on, the end of a ticket is the rating flow's: it asks for
  // the grade and sends the completion text itself, after the answer. The
  // question is not put, and a yes from an older window breaks nothing.
  it("leaves the end of the ticket to the rating flow when ratings are on", async () => {
    settings.userRating = "enabled";
    await expect(preview()).resolves.toEqual({ ask: false, message: null });
    await finish({ sendCompletion: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].body).toContain("Send a rating from 1 to 5");
    expect(send.mock.calls[0][0].body).not.toContain(MESSAGE);
    expect(row.status).toBe("closed");
  });

  it("sends nothing when the system finishes the ticket by itself", async () => {
    await UpdateTicketService({
      ticketId: 301,
      companyId: 10,
      ticketData: { status: "closed" }
    });
    expect(send).not.toHaveBeenCalled();
    expect(row.status).toBe("closed");
  });

  it("asks and sends for a paused ticket as for one in progress", async () => {
    row.status = "paused";
    await expect(preview()).resolves.toMatchObject({ ask: true });
    await finish({ sendCompletion: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("closed");
  });

  it("does not ask for a ticket that lost its connection, and says so to a yes", async () => {
    row.whatsapp = null;
    await expect(preview()).resolves.toEqual({ ask: false, message: null });
    await expect(finish({ sendCompletion: true })).rejects.toMatchObject({
      message: "ERR_COMPLETION_NOT_SENT"
    });
    expect(row.status).toBe("open");
  });

  // the group may be marked on the contact and not on the ticket
  it("agrees with the finish about what a group is", async () => {
    (row.contact as { isGroup: boolean }).isGroup = true;
    await expect(preview()).resolves.toEqual({ ask: false, message: null });
    await expect(finish({ sendCompletion: true })).rejects.toMatchObject({
      message: "ERR_COMPLETION_NOT_SENT"
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("asks nothing to someone who may not open the ticket", async () => {
    (AuthorizeTicketContextService as jest.Mock).mockRejectedValue(
      Object.assign(new Error("ERR_NO_PERMISSION"), { statusCode: 403 })
    );
    await expect(preview()).rejects.toMatchObject({ statusCode: 403 });
    expect(ShowTicketService).not.toHaveBeenCalled();
  });
});
