import Contact from "../../models/Contact";
import Schedule from "../../models/Schedule";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { SendMessage } from "../../helpers/SendMessage";
import SendScheduledMessageService from "../../services/ScheduleServices/SendScheduledMessageService";
import CreateNextOccurrenceService from "../../services/ScheduleServices/CreateNextOccurrenceService";

jest.mock("../../models/Contact", () => class {});
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Schedule", () => ({
  findByPk: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({
  findOne: jest.fn(),
  findAll: jest.fn()
}));
jest.mock("../../helpers/SendMessage", () => ({ SendMessage: jest.fn() }));
jest.mock("../../helpers/Mustache", () => ({
  mustacheFormat: ({ body }) => body
}));
jest.mock("../../helpers/GetPublicPath", () => ({
  getPublicPath: () => "/public"
}));
jest.mock("../../services/ScheduleServices/CreateNextOccurrenceService", () =>
  jest.fn().mockResolvedValue(null)
);
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn() }
}));

const companyId = 10;
const contact = {
  id: 11,
  companyId,
  channel: "whatsapp",
  number: "550000000001"
};
const casseb = { id: 31, companyId };
const cidadela = { id: 32, companyId };
const connection = (id: number, queues: Array<typeof casseb>) => ({
  id,
  companyId,
  status: "CONNECTED",
  channel: "whatsapp",
  isDefault: false,
  queues
});
const defaultChannel = { ...connection(20, []), isDefault: true };
const cassebChannel = connection(21, [casseb]);
const cidadelaChannel = connection(22, [cidadela]);
const fixture = {
  id: 51,
  companyId,
  contactId: contact.id,
  contact,
  sendAt: new Date("2026-01-01T10:00:00Z"),
  sentAt: null,
  status: "AGENDADA",
  body: "Lembrete fictício",
  saveMessage: true
};

const matches = (row: object, where: object) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

describe("scheduled WhatsApp delivery", () => {
  let channels: Array<ReturnType<typeof connection>>;
  let update: jest.Mock;

  beforeEach(() => {
    channels = [defaultChannel, cassebChannel, cidadelaChannel];
    update = jest.fn().mockResolvedValue(undefined);
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Whatsapp.findOne as jest.Mock).mockImplementation(
      async ({ where, include }) =>
        channels.find(
          channel =>
            matches(channel, where) &&
            (!include ||
              channel.queues.some(queue => matches(queue, include[0].where)))
        ) ?? null
    );
    (Whatsapp.findAll as jest.Mock).mockImplementation(async ({ where }) =>
      channels.filter(channel => matches(channel, where)).slice(0, 2)
    );
  });

  const schedule = (changes: object) => {
    const row = { ...fixture, ...changes, update };
    (Schedule.findByPk as jest.Mock).mockResolvedValue(row);
    return row;
  };

  it.each([
    ["Casseb", casseb.id, 21],
    ["Cidadela", cidadela.id, 22]
  ])(
    "sends %s schedules through the selected queue and retains the recurrence context",
    async (_, queueId, whatsappId) => {
      const row = schedule({
        queueId,
        routingMode: "queue",
        recurrence: "daily"
      });
      await SendScheduledMessageService(row.id);

      expect(SendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: whatsappId }),
        expect.objectContaining({
          body: row.body,
          number: contact.number,
          saveOnTicket: queueId
        })
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ENVIADA" })
      );
      expect(CreateNextOccurrenceService).toHaveBeenCalledWith(row);
    }
  );

  it("keeps the exact ticket channel when the queue also has another default channel", async () => {
    channels.unshift({ ...connection(19, [cidadela]), isDefault: true });
    const row = schedule({
      queueId: cidadela.id,
      ticketId: 61,
      routingMode: "ticket_queue"
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 61,
      queueId: cidadela.id,
      whatsappId: cidadelaChannel.id
    });

    await SendScheduledMessageService(row.id);
    expect(Ticket.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 61, companyId, contactId: contact.id, channel: "whatsapp" }
      })
    );
    expect(SendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: cidadelaChannel.id }),
      expect.objectContaining({ saveOnTicket: cidadela.id })
    );
  });

  it("rejects a disconnected linked channel even when another eligible one is connected", async () => {
    channels[2] = { ...cidadelaChannel, status: "DISCONNECTED" };
    channels.push(connection(23, [cidadela]));
    const row = schedule({
      queueId: cidadela.id,
      ticketId: 61,
      routingMode: "ticket_queue"
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 61,
      queueId: cidadela.id,
      whatsappId: cidadelaChannel.id
    });

    await expect(SendScheduledMessageService(row.id)).rejects.toMatchObject({
      message: "ERR_NO_CONNECTED_WHATSAPP_FOR_QUEUE"
    });
    expect(SendMessage).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ status: "ERRO" });
    expect(CreateNextOccurrenceService).toHaveBeenCalledWith(row);
  });

  it.each([
    [
      { routingMode: "ticket_queue", queueId: cidadela.id },
      "ERR_SCHEDULE_TICKET_CONTEXT"
    ],
    [{ routingMode: "queue", queueId: null }, "ERR_SCHEDULE_QUEUE_REQUIRED"],
    [{ ticketId: 61, routingMode: "ticket" }, "ERR_SCHEDULE_TICKET_CONTEXT"],
    [{}, "ERR_SCHEDULE_QUEUE_REQUIRED"],
    [{ contact: { ...contact, companyId: 99 } }, "ERR_SCHEDULE_TICKET_CONTEXT"]
  ])(
    "blocks a missing or unsafe route (%o) without sending",
    async (changes, message) => {
      const row = schedule(changes);
      await expect(SendScheduledMessageService(row.id)).rejects.toMatchObject({
        message
      });
      expect(SendMessage).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({ status: "ERRO" });
    }
  );

  it("allows an unscoped schedule when the company has a single connected WhatsApp", async () => {
    channels = [cidadelaChannel];
    const row = schedule({
      saveMessage: false,
      mediaPath: "media-persistant/10/abc/lembrete.pdf"
    });
    await SendScheduledMessageService(row.id);

    expect(SendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: cidadelaChannel.id }),
      expect.objectContaining({
        saveOnTicket: false,
        mediaPath: expect.stringMatching(/lembrete\.pdf$/)
      })
    );
  });

  it("addresses a linked group schedule to the group on the ticket channel", async () => {
    const group = Object.assign(new Contact(), contact, {
      number: "120000000000000000",
      isGroup: true
    });
    const row = schedule({
      contact: group,
      queueId: cidadela.id,
      ticketId: 61,
      routingMode: "ticket_queue"
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 61,
      queueId: cidadela.id,
      whatsappId: cidadelaChannel.id
    });
    await SendScheduledMessageService(row.id);

    expect(SendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: cidadelaChannel.id }),
      expect.objectContaining({ number: "120000000000000000@g.us" })
    );
  });

  it("does not send a deleted, already sent or rescheduled row", async () => {
    (Schedule.findByPk as jest.Mock).mockResolvedValueOnce(null);
    await SendScheduledMessageService(fixture.id);
    const sent = schedule({ status: "ENVIADA", sentAt: new Date() });
    await SendScheduledMessageService(sent.id);
    const postponed = schedule({ sendAt: new Date("2099-01-01T10:00:00Z") });
    await SendScheduledMessageService(postponed.id);

    expect(SendMessage).not.toHaveBeenCalled();
    expect(Schedule.update).toHaveBeenCalledWith(
      { status: "PENDENTE" },
      {
        where: {
          id: postponed.id,
          companyId,
          status: "AGENDADA",
          sentAt: null,
          sendAt: postponed.sendAt
        }
      }
    );
    expect(CreateNextOccurrenceService).not.toHaveBeenCalled();
  });
});
