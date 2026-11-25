import { Includeable, Op, Sequelize } from "sequelize";
import { TicketViewer } from "../../helpers/TicketAccessRules";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

// Required joins also hide malformed legacy pairs; never infer an office from
// the note's author or from a caller-supplied contact alone.
//
// `authorizedTicket`: the query is already pinned to ONE ticket that
// AuthorizeTicketContextService has just authorized for this viewer. The
// sector fence is then left out, because that ticket may be one that waits for
// the customer to pick a sector (no queue yet, RF-033): its notes must not
// vanish from the person who is allowed to read and write them.
export function ticketNoteScope(
  viewer: TicketViewer,
  { authorizedTicket = false }: { authorizedTicket?: boolean } = {}
): Includeable[] {
  return [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name"],
      where: { companyId: viewer.companyId },
      required: true
    },
    {
      model: Ticket,
      as: "ticket",
      attributes: ["id", "status", "createdAt"],
      where: {
        companyId: viewer.companyId,
        ...(viewer.isAdmin || authorizedTicket
          ? {}
          : { queueId: { [Op.in]: viewer.queueIds } }),
        [Op.and]: [
          Sequelize.where(
            Sequelize.col("ticket.contactId"),
            Op.eq,
            Sequelize.col("TicketNote.contactId")
          )
        ]
      },
      required: true
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name", "email"],
      where: { companyId: viewer.companyId },
      required: false
    }
  ];
}
