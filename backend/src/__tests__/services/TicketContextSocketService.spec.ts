import {
  emitTicketContext,
  refreshUserContextSockets,
  revokeTicketContextRooms
} from "../../services/SocketServices/TicketContextSocketService";
import AuthorizeTicketContextService, {
  loadTicketViewer
} from "../../services/TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../../services/MessageServices/AuthorizeMessageContextService";
import AppError from "../../errors/AppError";

jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({ __esModule: true, default: jest.fn(), loadTicketViewer: jest.fn() })
);
jest.mock("../../services/MessageServices/AuthorizeMessageContextService", () =>
  jest.fn()
);
jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

const recipient = (userId: number, companyId = 10) => ({
  data: {
    contextActor: { userId, companyId },
    ticketNotifications: true,
    ticketStatuses: ["pending"]
  },
  rooms: new Set([
    "301",
    `user-${userId}`,
    "queue-401-pending",
    "queue-401-notification"
  ]),
  emit: jest.fn(),
  join: jest.fn(),
  leave: jest.fn()
});

describe("context recipients use current authorization", () => {
  const allowed = new Set<number>();
  beforeEach(() => {
    allowed.clear();
    (AuthorizeTicketContextService as jest.Mock).mockImplementation(
      async (_ticketId, actor) => {
        if (actor.companyId !== 10 || !allowed.has(actor.userId))
          throw new AppError("ERR_NO_PERMISSION", 403);
        return { ticket: { id: 301 }, viewer: {} };
      }
    );
  });

  it("withholds payloads from assigned users without sectors and from another office", async () => {
    const staff = recipient(101);
    const admin = recipient(102);
    const withoutSector = recipient(103);
    const foreignAdmin = recipient(104, 20);
    allowed.add(101);
    allowed.add(102);
    allowed.add(104);
    const io = {
      in: jest.fn().mockReturnValue({
        fetchSockets: async () => [staff, admin, withoutSector, foreignAdmin]
      })
    };
    await emitTicketContext(
      io as never,
      301,
      "fixture-ticket",
      { ticket: { id: 301, lastMessage: "Fixture A" } },
      ["user-103", "301"]
    );
    expect(staff.emit).toHaveBeenCalledTimes(1);
    expect(admin.emit).toHaveBeenCalledTimes(1);
    expect(withoutSector.emit).not.toHaveBeenCalled();
    expect(foreignAdmin.emit).not.toHaveBeenCalled();
    expect(withoutSector.leave).toHaveBeenCalledWith("301");
  });

  it("revokes a transferred ticket before it can emit new context to an old subscriber", async () => {
    const socket = recipient(101);
    const io = {
      in: jest.fn().mockReturnValue({ fetchSockets: async () => [socket] })
    };
    allowed.add(101);
    await emitTicketContext(io as never, 301, "fixture-ticket", {}, ["301"]);
    socket.emit.mockClear();
    allowed.delete(101);
    await revokeTicketContextRooms(io as never, 301);
    await emitTicketContext(
      io as never,
      301,
      "fixture-ticket",
      { ticket: { lastMessage: "New sector" } },
      ["user-101"]
    );
    expect(socket.leave).toHaveBeenCalledWith("301");
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("removes ticket and queue subscriptions when user sectors are removed", async () => {
    const socket = recipient(101);
    const io = {
      in: jest.fn().mockReturnValue({ fetchSockets: async () => [socket] })
    };
    (loadTicketViewer as jest.Mock).mockResolvedValue({
      companyId: 10,
      isAdmin: false,
      queueIds: []
    });
    await refreshUserContextSockets(io as never, 101);
    expect(socket.leave).toHaveBeenCalledWith("301");
    expect(socket.leave).toHaveBeenCalledWith("queue-401-pending");
    expect(socket.leave).toHaveBeenCalledWith("queue-401-notification");
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("excludes quoted/reply context denied for this recipient without mutating the shared payload", async () => {
    const socket = recipient(101);
    const io = {
      in: jest.fn().mockReturnValue({ fetchSockets: async () => [socket] })
    };
    allowed.add(101);
    (AuthorizeMessageContextService as jest.Mock).mockRejectedValue(
      new AppError("ERR_MESSAGE_NOT_FOUND", 404)
    );
    const message = {
      companyId: 10,
      ticketId: 301,
      quotedMsg: { id: "foreign-quote" },
      replies: [{ id: "foreign-reply" }]
    };
    await emitTicketContext(io as never, 301, "fixture-message", { message }, [
      "301"
    ]);
    expect(socket.emit).toHaveBeenCalledWith("fixture-message", {
      message: { companyId: 10, ticketId: 301, quotedMsg: null, replies: [] }
    });
    expect(message.quotedMsg.id).toBe("foreign-quote");
    expect(message.replies).toHaveLength(1);
  });
});
