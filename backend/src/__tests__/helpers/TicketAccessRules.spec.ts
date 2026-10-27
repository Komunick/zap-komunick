import { ticketContextError } from "../../helpers/TicketAccessRules";

describe("ticket context authorization with fictitious offices and clients", () => {
  const ticket = { companyId: 10, contactId: 201, queueId: 401 };
  const viewer = { companyId: 10, isAdmin: false, queueIds: [401] };

  it("allows the selected client in an authorized sector", () => {
    expect(ticketContextError(ticket, viewer, 10, 201)).toBeUndefined();
  });

  it("denies a different office even to an administrator", () => {
    expect(
      ticketContextError(
        { ...ticket, companyId: 20 },
        { ...viewer, isAdmin: true },
        20
      )
    ).toBe("ERR_NO_TICKET_FOUND");
  });

  it("denies another client or a contact from another office", () => {
    expect(ticketContextError(ticket, viewer, 10, 202)).toBe(
      "ERR_NO_TICKET_FOUND"
    );
    expect(ticketContextError(ticket, viewer, 20, 201)).toBe(
      "ERR_NO_TICKET_FOUND"
    );
  });

  it("never interprets an empty sector list as access to all", () => {
    expect(ticketContextError(ticket, { ...viewer, queueIds: [] }, 10)).toBe(
      "ERR_NO_PERMISSION"
    );
    expect(ticketContextError(ticket, { ...viewer, queueIds: [402] }, 10)).toBe(
      "ERR_NO_PERMISSION"
    );
  });

  it("restricts unassigned tickets to administrators of their own office", () => {
    expect(ticketContextError({ ...ticket, queueId: null }, viewer, 10)).toBe(
      "ERR_NO_PERMISSION"
    );
    expect(
      ticketContextError(
        { ...ticket, queueId: null },
        { ...viewer, isAdmin: true },
        10
      )
    ).toBeUndefined();
  });
});
