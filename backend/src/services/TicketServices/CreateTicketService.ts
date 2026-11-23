import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import GetQueueWhatsApp from "../../helpers/GetQueueWhatsApp";
import Ticket from "../../models/Ticket";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";
import { emitTicketContext } from "../SocketServices/TicketContextSocketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Contact from "../../models/Contact";
import { incrementCounter } from "../CounterServices/IncrementCounter";
import OpenTicketConflictError from "./OpenTicketConflictService";
import UpdateTicketService from "./UpdateTicketService";
import { loadTicketViewer } from "./AuthorizeTicketContextService";
import { decideOwnTicketReuse } from "../../helpers/OwnTicketReuse";

interface Request {
  contactId: number;
  userId: number;
  companyId: number;
  queueId?: number;
  routeByQueue?: boolean;
  // Zap Komunick: who asked, to say if they may open or take the open ticket
  requesterId?: number;
}

const CreateTicketService = async ({
  contactId,
  userId,
  queueId,
  companyId,
  routeByQueue = false,
  requesterId
}: Request): Promise<Ticket> => {
  const useQueueWhatsapp = routeByQueue && Boolean(queueId);
  const whatsapp = useQueueWhatsapp
    ? await GetQueueWhatsApp(companyId, queueId)
    : await GetDefaultWhatsApp(companyId);

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
    // Zap Komunick: the person's own active ticket (pending with their name,
    // paused or without sector) is opened, not refused (RF-028); a pending
    // ticket with no person and no sector is taken into the chosen queue
    const actor = { userId: requesterId ?? Number(userId), companyId };
    const viewer = await loadTicketViewer(actor);
    const decision = decideOwnTicketReuse(ticket, {
      userId,
      queueId: useQueueWhatsapp ? queueId : null,
      isAdmin: viewer.isAdmin,
      queueIds: viewer.queueIds
    });
    if (decision.reuse) {
      try {
        // one after the other: the queue first, then the acceptance
        await decision.steps.reduce(
          (previous, step) =>
            previous.then(() =>
              UpdateTicketService({
                ticketData: { ...step, userId: Number(userId) },
                ticketId: ticket.id,
                companyId,
                reqUserId: Number(actor.userId)
              }).then(() => undefined)
            ),
          Promise.resolve()
        );
      } catch (err) {
        // an access rule refused it: say where the ticket is, as before
        if (
          err instanceof AppError &&
          (err.statusCode === 403 ||
            err.message === "ERR_QUEUE_NOT_LINKED_TO_WHATSAPP")
        ) {
          throw await OpenTicketConflictError(ticket.id, actor);
        }
        // a failure after saving (e.g. sending a message): open it anyway
        await ticket.reload();
        if (!(
          ticket.status === "open" && Number(ticket.userId) === Number(userId)
        )) {
          throw err;
        }
      }
      await ticket.reload({
        include
      });
      return ticket;
    }
    throw await OpenTicketConflictError(ticket.id, {
      userId: requesterId ?? userId,
      companyId
    });
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
