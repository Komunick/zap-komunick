import SyncTagsService from "../../services/TagServices/SyncTagsService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import ContactTag from "../../models/ContactTag";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import ShowContactService from "../../services/ContactServices/ShowContactService";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import { websocketUpdateContact } from "../../services/ContactServices/UpdateContactService";

jest.mock("../../models/Tag", () => ({ findAll: jest.fn() }));
jest.mock("../../models/TicketTag", () => ({
  destroy: jest.fn(),
  bulkCreate: jest.fn()
}));
jest.mock("../../models/ContactTag", () => ({
  destroy: jest.fn(),
  bulkCreate: jest.fn()
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn()
}));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/ContactServices/ShowContactService", () => jest.fn());
jest.mock("../../services/TicketServices/UpdateTicketService", () => ({
  websocketUpdateTicket: jest.fn()
}));
jest.mock("../../services/ContactServices/UpdateContactService", () => ({
  websocketUpdateContact: jest.fn()
}));

describe("SyncTagsService sector and company boundaries", () => {
  const tagRows = [
    { id: 1, queueIds: null },
    { id: 2, queueIds: [5] },
    { id: 3, queueIds: [6] },
    { id: 4, queueIds: [6] }
  ];
  const request = {
    ticketId: 13,
    companyId: 1,
    tags: [1, 2, 3, 4, 99].map(id => ({ id })) as Tag[]
  };
  const ticket = {
    id: 13,
    companyId: 1,
    queueId: 5,
    contactId: 7,
    tags: [{ id: 4 }],
    contact: { tags: [{ id: 4 }] },
    reload: jest.fn()
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (GetCompanySetting as jest.Mock).mockResolvedValue("ticket");
    (Tag.findAll as jest.Mock).mockResolvedValue(tagRows);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
  });

  it.each(["ticket", "both"])(
    "adds only compatible tags in %s mode and retains requested historical tags",
    async mode => {
      (GetCompanySetting as jest.Mock).mockResolvedValue(mode);
      await SyncTagsService(request);
      expect(TicketTag.bulkCreate).toHaveBeenCalledWith([
        { tagId: 1, ticketId: 13 },
        { tagId: 2, ticketId: 13 },
        { tagId: 4, ticketId: 13 }
      ]);
      expect(ContactTag.destroy).not.toHaveBeenCalled();
      expect(websocketUpdateContact).not.toHaveBeenCalled();
      expect(ShowTicketService).toHaveBeenCalledWith(13, 1);
      expect(Tag.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 1 } })
      );
    }
  );

  it("uses the contact's existing tags in contact mode", async () => {
    (GetCompanySetting as jest.Mock).mockResolvedValue("contact");
    await SyncTagsService(request);
    expect(ContactTag.bulkCreate).toHaveBeenCalledWith([
      { tagId: 1, contactId: 7 },
      { tagId: 2, contactId: 7 },
      { tagId: 4, contactId: 7 }
    ]);
    expect(TicketTag.destroy).not.toHaveBeenCalled();
  });

  it("publishes the changed contact when a conversation updates contact tags", async () => {
    (GetCompanySetting as jest.Mock).mockResolvedValue("contact");
    await SyncTagsService(request);
    expect(ticket.reload).toHaveBeenCalled();
    expect(websocketUpdateContact).toHaveBeenCalledWith(ticket.contact);
  });

  it("can remove a historical tag explicitly", async () => {
    await SyncTagsService({ ...request, tags: [{ id: 1 }] as Tag[] });
    expect(TicketTag.bulkCreate).toHaveBeenCalledWith([
      { tagId: 1, ticketId: 13 }
    ]);
  });

  it("rejects a ticket from another company before replacing associations", async () => {
    (ShowTicketService as jest.Mock).mockRejectedValue(new Error("forbidden"));
    await expect(SyncTagsService(request)).rejects.toThrow("forbidden");
    expect(ShowTicketService).toHaveBeenCalledWith(13, 1);
    expect(TicketTag.destroy).not.toHaveBeenCalled();
    expect(ContactTag.destroy).not.toHaveBeenCalled();
  });

  it("checks the company and ignores foreign tags when editing a contact", async () => {
    (GetCompanySetting as jest.Mock).mockResolvedValue("contact");
    (ShowContactService as jest.Mock).mockResolvedValue({ reload: jest.fn() });
    await SyncTagsService({
      companyId: 1,
      contactId: 7,
      tags: [{ id: 1 }, { id: 99 }] as Tag[]
    });
    expect(ShowContactService).toHaveBeenCalledWith(7, 1);
    expect(ContactTag.bulkCreate).toHaveBeenCalledWith([
      { tagId: 1, contactId: 7 }
    ]);
  });
});
