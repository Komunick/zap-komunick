import { Op, literal } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import User from "../../models/User";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import { parseSlaConfig } from "../../helpers/SlaRules";
import {
  buildSlaPanel,
  SlaPanel,
  SlaPanelTicket
} from "../../helpers/SlaPanel";

export const getSlaConfig = async (companyId: number) =>
  parseSlaConfig(
    await GetCompanySetting(companyId, "slaMinutes", "0"),
    await GetCompanySetting(companyId, "slaOldTicketHours", "")
  );

const SlaPanelService = async (companyId: number): Promise<SlaPanel> => {
  const config = await getSlaConfig(companyId);

  const tickets = await Ticket.findAll({
    where: {
      companyId,
      status: { [Op.or]: ["open", "pending"] }
    },
    attributes: [
      "id",
      "uuid",
      "status",
      "isGroup",
      "chatbot",
      "unansweredSince",
      "createdAt",
      [
        // start of the current service cycle
        literal(`(
          SELECT MAX(tt."createdAt")
          FROM "TicketTraking" tt
          WHERE tt."ticketId" = "Ticket"."id"
            AND tt."finishedAt" IS NULL
        )`),
        "cycleStartedAt"
      ]
    ],
    include: [
      { model: Contact, as: "contact", attributes: ["id", "name", "number"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: User, as: "user", attributes: ["id", "name"] }
    ]
  });

  const rows: SlaPanelTicket[] = tickets.map(ticket => {
    const plain = ticket.get({ plain: true }) as Ticket & {
      cycleStartedAt?: Date;
    };
    return {
      id: plain.id,
      uuid: plain.uuid,
      status: plain.status,
      isGroup: plain.isGroup,
      chatbot: plain.chatbot,
      unansweredSince: plain.unansweredSince,
      openedAt: plain.cycleStartedAt || plain.createdAt,
      contact: plain.contact,
      queue: plain.queue,
      user: plain.user
    };
  });

  return buildSlaPanel(rows, config);
};

export default SlaPanelService;
