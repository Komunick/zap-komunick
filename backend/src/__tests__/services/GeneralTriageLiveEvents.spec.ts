import { Server } from "socket.io";
import {
  emitTicketContext,
  removeTicketFromQueueLists,
  removeWaitingTicketFromGeneralLists,
  withGeneralTriageRooms
} from "../../services/SocketServices/TicketContextSocketService";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import {
  isWaitingInGeneralTriage,
  loadGeneralTriageScope
} from "../../helpers/GeneralTriage";
import Ticket from "../../models/Ticket";

jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({ __esModule: true, default: jest.fn(), loadTicketViewer: jest.fn() })
);
jest.mock("../../services/MessageServices/AuthorizeMessageContextService", () =>
  jest.fn()
);
jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));
jest.mock("../../models/Ticket", () => ({ findOne: jest.fn() }));
jest.mock("../../helpers/GeneralTriage", () => ({
  isWaitingInGeneralTriage: jest.fn(),
  loadGeneralTriageScope: jest.fn()
}));

// The rooms a ticket without a queue is addressed to today.
const noQueueRooms = [
  "301",
  "user-null",
  "queue-null-notification",
  "queue-null-pending",
  "company-10-notification",
  "company-10-pending"
];
const waitingTicket = {
  id: 301,
  companyId: 10,
  generalTriageStartedAt: new Date("2026-11-25T14:11:00Z")
};

const socketOf = (companyId: number) => ({
  data: { contextActor: { userId: 101, companyId } },
  rooms: new Set<string>(),
  emit: jest.fn(),
  join: jest.fn(),
  leave: jest.fn()
});

const ioWith = (sockets: ReturnType<typeof socketOf>[]) => {
  const fetchSockets = jest.fn().mockResolvedValue(sockets);
  const inRooms = jest.fn(() => ({ fetchSockets }));
  return { io: { in: inRooms } as unknown as Server, inRooms };
};

beforeEach(() => {
  jest.clearAllMocks();
  (Ticket.findOne as jest.Mock).mockResolvedValue(waitingTicket);
  (loadGeneralTriageScope as jest.Mock).mockResolvedValue({
    queueId: 7,
    whatsappIds: [2]
  });
  (isWaitingInGeneralTriage as jest.Mock).mockReturnValue(true);
});

describe("withGeneralTriageRooms", () => {
  it("adds the rooms of the general queue to a conversation waiting for a sector", async () => {
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toEqual([
      ...noQueueRooms,
      "queue-7-notification",
      "queue-7-pending"
    ]);
    expect(loadGeneralTriageScope).toHaveBeenCalledWith(10);
  });

  it("leaves a ticket that has a sector alone, without looking anything up", async () => {
    const rooms = ["301", "user-55", "queue-8-notification", "queue-8-open"];
    await expect(withGeneralTriageRooms(301, rooms)).resolves.toBe(rooms);
    expect(Ticket.findOne).not.toHaveBeenCalled();
    expect(loadGeneralTriageScope).not.toHaveBeenCalled();
  });

  it("leaves a ticket without sector that is not waiting alone", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      ...waitingTicket,
      generalTriageStartedAt: null
    });
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toBe(
      noQueueRooms
    );
    expect(loadGeneralTriageScope).not.toHaveBeenCalled();

    (Ticket.findOne as jest.Mock).mockResolvedValue(waitingTicket);
    (isWaitingInGeneralTriage as jest.Mock).mockReturnValue(false);
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toBe(
      noQueueRooms
    );
  });

  it("adds nothing when the company has no general triage or the ticket is gone", async () => {
    (loadGeneralTriageScope as jest.Mock).mockResolvedValue(null);
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toBe(
      noQueueRooms
    );
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toBe(
      noQueueRooms
    );
  });

  it("falls back to the original rooms when the lookup fails", async () => {
    (Ticket.findOne as jest.Mock).mockRejectedValue(new Error("db down"));
    await expect(withGeneralTriageRooms(301, noQueueRooms)).resolves.toBe(
      noQueueRooms
    );
  });
});

describe("emitTicketContext", () => {
  it("reaches the general queue, and still authorizes each recipient", async () => {
    const allowed = socketOf(10);
    const denied = socketOf(10);
    denied.data.contextActor.userId = 202;
    (AuthorizeTicketContextService as jest.Mock).mockImplementation(
      async (_id, actor) => {
        if (actor.userId !== 101) throw new Error("ERR_NO_PERMISSION");
        return { ticket: { id: 301 }, viewer: {} };
      }
    );
    const { io, inRooms } = ioWith([allowed, denied]);

    await emitTicketContext(
      io,
      301,
      "company-10-ticket",
      { action: "update", ticket: { id: 301 } },
      noQueueRooms
    );

    expect(inRooms).toHaveBeenCalledWith(
      expect.arrayContaining(["queue-7-notification", "queue-7-pending"])
    );
    expect(allowed.emit).toHaveBeenCalledWith(
      "company-10-ticket",
      expect.objectContaining({ action: "update" })
    );
    // being in the room is not enough: the access rule decides
    expect(denied.emit).not.toHaveBeenCalled();
  });
});

describe("removeTicketFromQueueLists", () => {
  it("takes the ticket out of the lists of the queue, in its company only", async () => {
    const same = socketOf(10);
    const other = socketOf(11);
    const { io, inRooms } = ioWith([same, other]);

    await removeTicketFromQueueLists(io, { id: 301, companyId: 10 }, 7);

    expect(inRooms).toHaveBeenCalledWith([
      "queue-7-notification",
      "queue-7-pending"
    ]);
    expect(same.emit).toHaveBeenCalledWith("company-10-ticket", {
      action: "removeFromList",
      ticketId: 301
    });
    expect(other.emit).not.toHaveBeenCalled();
  });

  it("does nothing without a queue and never throws", async () => {
    const { io, inRooms } = ioWith([]);
    await removeTicketFromQueueLists(io, { id: 301, companyId: 10 }, null);
    expect(inRooms).not.toHaveBeenCalled();

    const broken = {
      in: () => ({ fetchSockets: jest.fn().mockRejectedValue(new Error("x")) })
    } as unknown as Server;
    await expect(
      removeTicketFromQueueLists(broken, { id: 301, companyId: 10 }, 7)
    ).resolves.toBeUndefined();
  });
});

describe("removeWaitingTicketFromGeneralLists", () => {
  const deleted = {
    id: 301,
    companyId: 10,
    status: "pending",
    queueId: null,
    generalTriageStartedAt: new Date("2026-11-25T14:11:00Z")
  };

  it("takes a deleted waiting conversation out of the lists of the general queue", async () => {
    const member = socketOf(10);
    const { io, inRooms } = ioWith([member]);

    await removeWaitingTicketFromGeneralLists(io, deleted);

    expect(isWaitingInGeneralTriage).toHaveBeenCalledWith(deleted, {
      queueId: 7,
      whatsappIds: [2]
    });
    expect(inRooms).toHaveBeenCalledWith([
      "queue-7-notification",
      "queue-7-pending"
    ]);
    expect(member.emit).toHaveBeenCalledWith("company-10-ticket", {
      action: "removeFromList",
      ticketId: 301
    });
  });

  it("does nothing, and looks nothing up, for a ticket that was not waiting", async () => {
    const { io, inRooms } = ioWith([]);
    await removeWaitingTicketFromGeneralLists(io, { ...deleted, queueId: 8 });
    await removeWaitingTicketFromGeneralLists(io, {
      ...deleted,
      generalTriageStartedAt: null
    });
    expect(loadGeneralTriageScope).not.toHaveBeenCalled();

    (isWaitingInGeneralTriage as jest.Mock).mockReturnValue(false);
    await removeWaitingTicketFromGeneralLists(io, deleted);
    expect(inRooms).not.toHaveBeenCalled();
  });

  it("never turns a delete that worked into an error", async () => {
    (loadGeneralTriageScope as jest.Mock).mockRejectedValue(new Error("db"));
    const { io } = ioWith([]);
    await expect(
      removeWaitingTicketFromGeneralLists(io, deleted)
    ).resolves.toBeUndefined();
  });
});
