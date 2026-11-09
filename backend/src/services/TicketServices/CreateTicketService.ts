import { col, fn } from "sequelize";
import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";
import { emitTicketContext } from "../SocketServices/TicketContextSocketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Contact from "../../models/Contact";
import { incrementCounter } from "../CounterServices/IncrementCounter";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  contactId: number;
  userId: number;
  companyId: number;
  queueId?: number;
  routeByQueue?: boolean;
}

const CreateTicketService = async ({
  contactId,
  userId,
  queueId,
  companyId,
  routeByQueue = false
}: Request): Promise<Ticket> => {
  const useQueueWhatsapp = routeByQueue && Boolean(queueId);
  const whatsapp = useQueueWhatsapp
    ? await Whatsapp.findOne({
        attributes: ["id", "isDefault"],
        where: { companyId, channel: "whatsapp", status: "CONNECTED" },
        include: [
          {
            model: Queue,
            as: "queues",
            attributes: [],
            through: { attributes: [] },
            required: true,
            where: { id: queueId, companyId }
          }
        ],
        order: [
          [fn("COALESCE", col("Whatsapp.isDefault"), false), "DESC"],
          ["id", "ASC"]
        ]
      })
    : await GetDefaultWhatsApp(companyId);

  if (!whatsapp) {
    throw new AppError("ERR_NO_CONNECTED_WHATSAPP_FOR_QUEUE");
  }

  let ticket = await CheckContactOpenTickets(contactId, whatsapp.id, true);

  const include = [
    {
      model: Contact,
      as: "contact",
      include: ["tags", "extraInfo"]
    },
    "queue",
    "whatsapp",
    "user",
    "tags"
  ];

  if (ticket) {
    if (
      ticket.status === "open" &&
      ticket.userId === userId &&
      (!useQueueWhatsapp || ticket.queueId === queueId)
    ) {
      await ticket.reload({
        include
      });
      return ticket;
    }
    throw new AppError("ERR_OTHER_OPEN_TICKET");
  }

  const { isGroup } = await ShowContactService(contactId, companyId);

  ticket = await Ticket.create({
    contactId,
    companyId,
    queueId,
    whatsappId: whatsapp.id,
    status: "open",
    isGroup,
    userId
  });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    userId: ticket.userId
  });

  incrementCounter(ticket.companyId, "ticket-create");

  await ticket.reload({
    include
  });

  const io = getIO();

  await emitTicketContext(
    io,
    ticket.id,
    "ticket",
    {
      action: "update",
      ticket
    },
    [ticket.id.toString()]
  );

  return ticket;
};

export default CreateTicketService;
