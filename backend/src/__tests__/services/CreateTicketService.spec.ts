import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateTicketService from "../../services/TicketServices/CreateTicketService";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";
import UpdateTicketService from "../../services/TicketServices/UpdateTicketService";
import AppError from "../../errors/AppError";

jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn().mockResolvedValue(null),
  create: jest.fn()
}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../services/ContactServices/ShowContactService", () =>
  jest.fn().mockResolvedValue({ isGroup: false })
);
jest.mock(
  "../../services/TicketServices/FindOrCreateATicketTrakingService",
  () => jest.fn()
);
jest.mock("../../services/CounterServices/IncrementCounter", () => ({
  incrementCounter: jest.fn()
}));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  emitTicketContext: jest.fn()
}));
jest.mock("../../utils/logger", () => ({ logger: { info: jest.fn() } }));
jest.mock("../../services/TicketServices/UpdateTicketService", () =>
  jest.fn().mockResolvedValue({})
);
const mockViewer = { companyId: 10, isAdmin: false, queueIds: [42, 41] };
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({
    loadTicketViewer: jest.fn(async () => mockViewer)
  })
);

const casseb = { id: 41, companyId: 10 };
const cidadela = { id: 42, companyId: 10 };
const queueWithoutChannel = { id: 43, companyId: 10 };
const foreignQueue = { id: 51, companyId: 20 };
const manualRouting = { routeByQueue: true };
const request = { contactId: 201, companyId: 10, userId: 101 };

const channel = (id: number, queues: (typeof casseb)[]) => ({
  id,
  companyId: 10,
  status: "CONNECTED",
  channel: "whatsapp",
  isDefault: false as boolean | null,
  queues
});

const fixtures = [
  { ...channel(1, []), isDefault: true },
  channel(3, [casseb]),
  channel(4, [cidadela]),
  { ...channel(5, [queueWithoutChannel, cidadela]), status: "DISCONNECTED" },
  { ...channel(6, [queueWithoutChannel]), channel: "instagram" },
  { ...channel(7, [queueWithoutChannel]), companyId: 20 },
  channel(8, [foreignQueue])
];

type Query = {
  where: Partial<(typeof fixtures)[number]>;
  include?: Array<{ where: Partial<typeof casseb> }>;
  order?: string[][];
};

const matches = (row: object, where: object): boolean =>
  Object.entries(where).every(([key, value]) => row[key] === value);

describe("WhatsApp for a new ticket", () => {
  let channels: typeof fixtures;

  beforeEach(() => {
    (UpdateTicketService as jest.Mock).mockClear();
    channels = [...fixtures];
    (Whatsapp.findOne as jest.Mock).mockImplementation(
      async ({ where, include = [], order }: Query) => {
        const candidates = channels.filter(
          whatsapp =>
            matches(whatsapp, where) &&
            include.every(({ where: queueWhere }) =>
              whatsapp.queues.some(queue => matches(queue, queueWhere))
            )
        );
        if (order?.length) {
          candidates.sort(
            (a, b) =>
              Number(b.isDefault === true) - Number(a.isDefault === true) ||
              a.id - b.id
          );
        }
        return candidates[0] ?? null;
      }
    );
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Ticket.create as jest.Mock).mockImplementation(async data => ({
      id: 301,
      ...data,
      reload: jest.fn()
    }));
  });

  it.each([
    ["Casseb", casseb.id, 3],
    ["Cidadela", cidadela.id, 4]
  ])(
    "creates the %s ticket on its queue's channel",
    async (_, queueId, whatsappId) => {
      const ticket = await CreateTicketService({
        ...request,
        queueId,
        ...manualRouting
      });

      expect(ticket).toMatchObject({ queueId, whatsappId });
      expect(FindOrCreateATicketTrakingService).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: ticket.id, whatsappId })
      );
    }
  );

  it.each([queueWithoutChannel.id, foreignQueue.id])(
    "rejects queue %i without an eligible channel before creating anything",
    async queueId => {
      await expect(
        CreateTicketService({ ...request, ...manualRouting, queueId })
      ).rejects.toMatchObject({
        message: "ERR_NO_CONNECTED_WHATSAPP_FOR_QUEUE"
      });

      expect(Ticket.create).not.toHaveBeenCalled();
      expect(FindOrCreateATicketTrakingService).not.toHaveBeenCalled();
    }
  );

  it("prefers a default channel if it is connected to the selected queue", async () => {
    channels.push({ ...channel(9, [cidadela]), isDefault: true });

    await expect(
      CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      })
    ).resolves.toMatchObject({ whatsappId: 9 });
  });

  it("keeps the default channel when no queue is selected", async () => {
    await expect(
      CreateTicketService({ ...request, ...manualRouting, queueId: null })
    ).resolves.toMatchObject({ whatsappId: 1 });
  });

  it("keeps the legacy channel selection for callers outside Novo atendimento", async () => {
    await expect(
      CreateTicketService({ ...request, queueId: cidadela.id })
    ).resolves.toMatchObject({ whatsappId: 1 });
  });

  // Zap Komunick (RF-028): the person's own active ticket is opened, in its
  // own sector, when it is pending with their name or paused
  it.each([
    ["open, same queue", "open", cidadela.id, []],
    ["open, another queue of theirs", "open", casseb.id, []],
    ["pending with their name", "pending", cidadela.id, [{ status: "open" }]],
    ["paused", "paused", cidadela.id, [{ status: "open" }]],
    [
      "pending without sector",
      "pending",
      null,
      [{ queueId: cidadela.id }, { status: "open" }]
    ]
  ])(
    "opens the user's own active ticket (%s)",
    async (_, status, existingQueueId, steps) => {
      const existingTicket = {
        id: 302,
        userId: request.userId,
        whatsappId: 4,
        queueId: existingQueueId,
        status,
        reload: jest.fn()
      };
      (Ticket.findOne as jest.Mock).mockResolvedValue(existingTicket);

      await expect(
        CreateTicketService({
          ...request,
          queueId: cidadela.id,
          ...manualRouting
        })
      ).resolves.toBe(existingTicket);

      expect(UpdateTicketService).toHaveBeenCalledTimes(steps.length);
      steps.forEach((step, index) =>
        expect(UpdateTicketService).toHaveBeenNthCalledWith(index + 1, {
          ticketData: { ...step, userId: request.userId },
          ticketId: 302,
          companyId: 10,
          reqUserId: request.userId
        })
      );
      expect(Ticket.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ whatsappId: 4 })
      });
      expect(Ticket.create).not.toHaveBeenCalled();
    }
  );

  it("does not open the user's ticket in a queue they no longer have", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 305,
      userId: request.userId,
      whatsappId: 4,
      queueId: 77,
      status: "open",
      reload: jest.fn()
    });

    await expect(
      CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      })
    ).rejects.toMatchObject({ message: "ERR_OTHER_OPEN_TICKET" });
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("still refuses a ticket in service with someone else", async () => {
    const existingTicket = {
      id: 303,
      userId: 999,
      whatsappId: 4,
      queueId: cidadela.id,
      status: "open",
      reload: jest.fn()
    };
    (Ticket.findOne as jest.Mock).mockResolvedValue(existingTicket);

    await expect(
      CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      })
    ).rejects.toMatchObject({ message: "ERR_OTHER_OPEN_TICKET" });
    expect(UpdateTicketService).not.toHaveBeenCalled();
    expect(existingTicket.reload).not.toHaveBeenCalled();
    expect(Ticket.create).not.toHaveBeenCalled();
  });

  it("says where the ticket is when an access rule refuses to open it", async () => {
    const existingTicket = {
      id: 304,
      userId: request.userId,
      whatsappId: 4,
      queueId: cidadela.id,
      status: "pending",
      reload: jest.fn()
    };
    (Ticket.findOne as jest.Mock).mockResolvedValue(existingTicket);
    (UpdateTicketService as jest.Mock).mockRejectedValueOnce(
      new AppError("ERR_NO_PERMISSION", 403)
    );

    await expect(
      CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      })
    ).rejects.toMatchObject({ message: "ERR_OTHER_OPEN_TICKET" });
  });

  it("opens the ticket when only a later step (sending) failed", async () => {
    const existingTicket = {
      id: 306,
      userId: request.userId,
      whatsappId: 4,
      queueId: cidadela.id,
      status: "pending",
      reload: jest.fn(async function (this: { status: string }) {
        this.status = "open";
      })
    };
    (Ticket.findOne as jest.Mock).mockResolvedValue(existingTicket);
    (UpdateTicketService as jest.Mock).mockRejectedValueOnce(
      new Error("ERR_SENDING_WAPP_MSG")
    );

    await expect(
      CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      })
    ).resolves.toBe(existingTicket);
  });
});
