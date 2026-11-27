import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import CreateTransferNoteService from "../../services/MessageServices/CreateTransferNoteService";

jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Whatsapp", () => ({}));
jest.mock("../../models/Queue", () => ({
  findByPk: jest.fn(async id => ({ id, name: `fila ${id}` }))
}));
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(async id => ({ id, name: `pessoa ${id}` }))
}));
jest.mock("../../services/MessageServices/CreateMessageService", () => ({
  websocketCreateMessage: jest.fn()
}));

type Row = Record<string, unknown>;

// The client has two tickets. 301 is the one being transferred; 300 is an
// older one, of another sector, that the person transferring may not read.
const rows: Row[] = [
  {
    id: "of-this-ticket",
    ticketId: 301,
    companyId: 10,
    fromMe: false,
    body: "preciso da guia",
    mediaType: "conversation",
    createdAt: new Date("2026-11-26T12:00:00Z"),
    contact: { name: "Cliente" }
  },
  {
    id: "of-another-ticket",
    ticketId: 300,
    companyId: 10,
    fromMe: false,
    body: "SEGREDO_DE_OUTRO_SETOR",
    mediaType: "conversation",
    createdAt: new Date("2026-11-20T12:00:00Z"),
    contact: { name: "Cliente" }
  },
  {
    id: "of-another-office",
    ticketId: 301,
    companyId: 20,
    fromMe: false,
    body: "SEGREDO_DE_OUTRA_EMPRESA",
    mediaType: "conversation",
    createdAt: new Date("2026-11-26T12:00:00Z"),
    contact: { name: "Outro" }
  }
];

const ticket = {
  id: 301,
  contactId: 201,
  companyId: 10,
  queueId: 402,
  userId: null,
  channel: "whatsapp"
} as unknown as Ticket;

beforeEach(() => {
  jest.clearAllMocks();
  (Ticket.findAll as jest.Mock).mockResolvedValue([{ id: 300 }, { id: 301 }]);
  (Message.findAll as jest.Mock).mockImplementation(async ({ where }) =>
    rows.filter(row => {
      const tickets =
        typeof where.ticketId === "object"
          ? where.ticketId[Op.in]
          : [where.ticketId];
      return (
        where.id[Op.in].includes(row.id) &&
        tickets.includes(row.ticketId) &&
        row.companyId === where.companyId
      );
    })
  );
  (Message.create as jest.Mock).mockResolvedValue(undefined);
  (Message.findByPk as jest.Mock).mockResolvedValue({ id: "note" });
});

const createNote = (messageIds: string[]) =>
  CreateTransferNoteService({
    ticket,
    parsed: { note: "quer a guia do DAS", messageIds },
    userId: 5,
    fromQueueId: 401,
    fromUserId: 5
  });

const written = () => (Message.create as jest.Mock).mock.calls[0][0];

describe("what a transfer note may quote", () => {
  it("quotes the messages of the ticket being transferred", async () => {
    await createNote(["of-this-ticket"]);
    const note = JSON.parse(written().dataJson).transferNote;
    expect(note.quotes.map((quote: { id: string }) => quote.id)).toEqual([
      "of-this-ticket"
    ]);
    expect(written().body).toContain("preciso da guia");
  });

  // The window of the transfer only offers messages of the open ticket. An id
  // of another ticket of the client, sent by hand, used to be copied into the
  // note without asking whether the person may read that message.
  it("does not copy a message of another ticket of the client, whatever id is sent", async () => {
    await createNote(["of-this-ticket", "of-another-ticket"]);
    const note = JSON.parse(written().dataJson).transferNote;
    expect(note.quotes.map((quote: { id: string }) => quote.id)).toEqual([
      "of-this-ticket"
    ]);
    expect(JSON.stringify(written())).not.toContain("SEGREDO_DE_OUTRO_SETOR");
    const { where } = (Message.findAll as jest.Mock).mock.calls[0][0];
    expect(where.ticketId).toBe(301);
    expect(where.companyId).toBe(10);
    // the other tickets of the client are not even looked up
    expect(Ticket.findAll).not.toHaveBeenCalled();
  });

  it("does not copy a message of another office with the same ticket number", async () => {
    await createNote(["of-another-office"]);
    expect(JSON.parse(written().dataJson).transferNote.quotes).toEqual([]);
    expect(JSON.stringify(written())).not.toContain("SEGREDO_DE_OUTRA_EMPRESA");
  });

  it("writes the note alone when no message is picked, without looking for any", async () => {
    await createNote([]);
    expect(Message.findAll).not.toHaveBeenCalled();
    expect(written()).toMatchObject({
      ticketId: 301,
      companyId: 10,
      queueId: 402,
      mediaType: "transferNote"
    });
    expect(JSON.parse(written().dataJson).transferNote.note).toBe(
      "quer a guia do DAS"
    );
  });
});
