import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateTicketService from "../../services/TicketServices/CreateTicketService";
import FindOrCreateATicketTrakingService from "../../services/TicketServices/FindOrCreateATicketTrakingService";

jest.mock("../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
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

  it.each([cidadela.id, casseb.id])(
    "only reuses the user's existing ticket when it belongs to the selected queue (%i)",
    async existingQueueId => {
      const existingTicket = {
        id: 302,
        userId: request.userId,
        whatsappId: 4,
        queueId: existingQueueId,
        status: "open",
        reload: jest.fn()
      };
      (Ticket.findOne as jest.Mock).mockResolvedValue(existingTicket);

      const result = CreateTicketService({
        ...request,
        queueId: cidadela.id,
        ...manualRouting
      });

      if (existingQueueId === cidadela.id) {
        await expect(result).resolves.toBe(existingTicket);
      } else {
        await expect(result).rejects.toMatchObject({
          message: "ERR_OTHER_OPEN_TICKET"
        });
        expect(existingTicket.reload).not.toHaveBeenCalled();
      }
      expect(Ticket.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ whatsappId: 4 })
      });
      expect(Ticket.create).not.toHaveBeenCalled();
    }
  );
});
