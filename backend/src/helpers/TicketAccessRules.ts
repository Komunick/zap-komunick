// Zap Komunick: context must belong to the selected office, client and sector.
export interface TicketViewer {
  companyId: number;
  isAdmin: boolean;
  queueIds: number[];
}

export interface TicketContext {
  companyId: number;
  contactId: number;
  queueId: number | null;
}

export function ticketContextError(
  ticket: TicketContext,
  viewer: TicketViewer,
  contactCompanyId: number,
  expectedContactId?: number
): "ERR_NO_TICKET_FOUND" | "ERR_NO_PERMISSION" | undefined {
  if (
    ticket.companyId !== viewer.companyId ||
    contactCompanyId !== viewer.companyId ||
    (expectedContactId !== undefined && ticket.contactId !== expectedContactId)
  ) {
    return "ERR_NO_TICKET_FOUND";
  }
  if (
    !viewer.isAdmin &&
    (ticket.queueId === null || !viewer.queueIds.includes(ticket.queueId))
  ) {
    return "ERR_NO_PERMISSION";
  }
  return undefined;
}
