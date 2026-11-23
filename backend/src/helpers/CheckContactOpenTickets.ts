import { Op, WhereOptions } from "sequelize";
import OpenTicketConflictError from "../services/TicketServices/OpenTicketConflictService";
import { ContextActor } from "../services/TicketServices/AuthorizeTicketContextService";
import Ticket from "../models/Ticket";
import { ACTIVE_TICKET_STATUSES } from "./TicketPauseAndClose";

const CheckContactOpenTickets = async (
  contactId: number,
  whatsappId?: number,
  returnTicket = false,
  actor?: ContextActor
): Promise<Ticket> => {
  const where: WhereOptions<Ticket> = {
    contactId,
    status: { [Op.or]: ACTIVE_TICKET_STATUSES }
  };

  if (whatsappId) {
    where.whatsappId = whatsappId;
  }

  const ticket = await Ticket.findOne({
    where
  });

  if (ticket && !returnTicket) {
    // Zap Komunick: tell who has it (RF-026)
    throw await OpenTicketConflictError(ticket.id, actor);
  }

  return ticket;
};

export default CheckContactOpenTickets;
