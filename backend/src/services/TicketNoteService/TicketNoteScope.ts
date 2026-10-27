import { Includeable, Op, Sequelize } from "sequelize";
import { TicketViewer } from "../../helpers/TicketAccessRules";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

// Required joins also hide malformed legacy pairs; never infer an office from
// the note's author or from a caller-supplied contact alone.
export function ticketNoteScope(viewer: TicketViewer): Includeable[] {
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
        ...(viewer.isAdmin ? {} : { queueId: { [Op.in]: viewer.queueIds } }),
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
