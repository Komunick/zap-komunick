import GetTicketWbot from "../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({}));

const emit = jest.fn();
const to = jest.fn(() => ({ emit }));
const fictionalTicket = (queueId: number | null, unreadMessages: number) => ({
  id: 301,
  companyId: 10,
  whatsappId: 2,
  queueId,
  status: "open",
  unreadMessages,
  update: jest.fn()
});

beforeEach(() => {
  jest.clearAllMocks();
  (GetTicketWbot as jest.Mock).mockResolvedValue(null);
  (getIO as jest.Mock).mockReturnValue({ to });
});

it.each([
  { queueId: 401, queueRooms: ["queue-401-open", "queue-401-notification"] },
  { queueId: null, queueRooms: [] }
])(
  "invalidates unread notifications for queue $queueId",
  async ({ queueId, queueRooms }) => {
    const ticket = fictionalTicket(queueId, 1);

    await SetTicketMessagesAsRead(ticket as unknown as Ticket);

    expect(ticket.update).toHaveBeenCalledWith(
      { unreadMessages: 0 },
      { silent: true }
    );
    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      { where: { ticketId: 301, read: false } }
    );
    expect(to).toHaveBeenCalledWith(["301", "company-10-open", ...queueRooms]);
    expect(emit).toHaveBeenCalledWith("company-10-ticket", {
      action: "updateUnread",
      ticketId: 301
    });
  }
);

it("keeps the notification event quiet when the ticket was already read", async () => {
  const ticket = fictionalTicket(401, 0);
  await SetTicketMessagesAsRead(ticket as unknown as Ticket);
  expect(emit).not.toHaveBeenCalled();
});

it("invalidates notifications when stored unread messages exist despite a zero counter", async () => {
  const ticket = fictionalTicket(401, 0);
  (GetTicketWbot as jest.Mock).mockResolvedValue({ readMessages: jest.fn() });
  (Message.findAll as jest.Mock).mockResolvedValue([
    {
      dataJson: JSON.stringify({ key: { id: "fixture-message" } }),
      createdAt: new Date()
    }
  ]);

  await SetTicketMessagesAsRead(ticket as unknown as Ticket);

  expect(emit).toHaveBeenCalledWith("company-10-ticket", {
    action: "updateUnread",
    ticketId: 301
  });
});

// Zap Komunick (RF-029): history imported from the previous system has no
// channel; opening it must not save the default connection on it
it("does not touch WhatsApp for a ticket without channel", async () => {
  const ticket = { ...fictionalTicket(401, 0), whatsappId: null };

  await SetTicketMessagesAsRead(ticket as unknown as Ticket);

  expect(GetTicketWbot).not.toHaveBeenCalled();
  expect(ticket.update).toHaveBeenCalledWith(
    { unreadMessages: 0 },
    { silent: true }
  );
});
