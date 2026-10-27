import ShowTicketNoteService from "../../services/TicketNoteService/ShowTicketNoteService";
import TicketNote from "../../models/TicketNote";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Contact from "../../models/Contact";
import CreateTicketNoteService from "../../services/TicketNoteService/CreateTicketNoteService";
import UpdateTicketNoteService from "../../services/TicketNoteService/UpdateTicketNoteService";
import DeleteTicketNoteService from "../../services/TicketNoteService/DeleteTicketNoteService";

jest.mock("../../models/TicketNote", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), create: jest.fn() }
}));
jest.mock("../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../models/User", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../models/Queue", () => ({ __esModule: true, default: {} }));

// Fictitious offices and clients. No database, WhatsApp or external service.
const actor = { userId: "101", companyId: 10 };
const note = { id: 501, ticketId: 301, contactId: 201, note: "Fixture A" };
const showNote = ShowTicketNoteService as unknown as (
  id: number,
  viewer: typeof actor
) => Promise<unknown>;

describe("ticket note context isolation", () => {
  beforeEach(() => {
    (TicketNote.findByPk as jest.Mock).mockResolvedValue(note);
    (User.findOne as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "user",
      queues: [{ id: 401, companyId: 10 }]
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 301,
      companyId: 10,
      contactId: 201,
      queueId: 401
    });
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 201,
      companyId: 10
    });
  });

  it("rejects a note ID whose ticket belongs to another office", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    await expect(showNote(501, actor)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("rejects context for an attendant with no sector", async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "user",
      queues: []
    });
    await expect(showNote(501, actor)).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it("rejects a note whose contact does not match its ticket", async () => {
    (TicketNote.findByPk as jest.Mock).mockResolvedValue({
      ...note,
      contactId: 202
    });
    await expect(showNote(501, actor)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("allows a valid note without altering the contact catalog", async () => {
    await expect(showNote(501, actor)).resolves.toBe(note);
  });

  it("creates only the selected pair with the authenticated author", async () => {
    const payload = {
      ...note,
      userId: 999,
      companyId: 20,
      id: 999
    };
    await CreateTicketNoteService(payload, actor);
    expect(TicketNote.create).toHaveBeenCalledWith({
      note: "Fixture A",
      userId: 101,
      contactId: 201,
      ticketId: 301
    });
  });

  it("updates only the URL note and text, preserving author and context", async () => {
    const update = jest.fn();
    (TicketNote.findByPk as jest.Mock).mockResolvedValue({ ...note, update });
    await UpdateTicketNoteService(
      501,
      {
        note: "Updated fixture",
        id: 999,
        contactId: 999,
        ticketId: 999,
        userId: 999
      } as { note: string },
      actor
    );
    expect(TicketNote.findByPk).toHaveBeenCalledWith(501);
    expect(update).toHaveBeenCalledWith({ note: "Updated fixture" });
  });

  it("does not write or delete a note outside the authorized context", async () => {
    const update = jest.fn();
    const destroy = jest.fn();
    (TicketNote.findByPk as jest.Mock).mockResolvedValue({
      ...note,
      update,
      destroy
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (User.findOne as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "admin",
      queues: []
    });
    await expect(
      UpdateTicketNoteService(501, { note: "Denied" }, actor)
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(DeleteTicketNoteService("501", actor)).rejects.toMatchObject({
      statusCode: 404
    });
    await expect(CreateTicketNoteService(note, actor)).rejects.toMatchObject({
      statusCode: 404
    });
    expect(update).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(TicketNote.create).not.toHaveBeenCalled();
  });

  it("allows an administrator to read an unassigned ticket of their office", async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "admin",
      queues: []
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      id: 301,
      companyId: 10,
      contactId: 201,
      queueId: null
    });
    await expect(showNote(501, actor)).resolves.toBe(note);
  });
});
