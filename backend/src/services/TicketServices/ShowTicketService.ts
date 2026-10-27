import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import UserSocketSession from "../../models/UserSocketSession";
import Company from "../../models/Company";

const ShowTicketService = async (
  id: string | number,
  companyId?: number
): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: {
      id,
      ...(companyId === undefined ? {} : { companyId })
    },
    include: [
      {
        model: Contact,
        as: "contact",
        ...(companyId === undefined
          ? {}
          : { where: { companyId }, required: true }),
        attributes: [
          "id",
          "name",
          "number",
          "email",
          "profilePicUrl",
          "profileHiresPictureUrl",
          "presence",
          "disableBot",
          "language"
        ],
        include: [
          {
            model: Tag,
            as: "tags",
            ...(companyId === undefined
              ? {}
              : { where: { companyId }, required: false })
          },
          "extraInfo"
        ]
      },
      {
        model: User,
        as: "user",
        ...(companyId === undefined
          ? {}
          : { where: { companyId }, required: false }),
        attributes: ["id", "name"],
        include: [
          {
            model: UserSocketSession,
            as: "socketSessions",
            where: { active: true },
            required: false
          }
        ]
      },
      {
        model: Queue,
        as: "queue",
        ...(companyId === undefined
          ? {}
          : { where: { companyId }, required: false }),
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        ...(companyId === undefined
          ? {}
          : { where: { companyId }, required: false }),
        attributes: [
          "name",
          "status",
          "ratingMessage",
          "transferMessage",
          "complationMessage",
          "language"
        ]
      },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name", "language"]
      },
      {
        model: Tag,
        as: "tags",
        ...(companyId === undefined
          ? {}
          : { where: { companyId }, required: false }),
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (companyId && ticket?.companyId !== companyId) {
    throw new AppError("Não é possível consultar registros de outra empresa");
  }

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  return ticket;
};

export default ShowTicketService;
