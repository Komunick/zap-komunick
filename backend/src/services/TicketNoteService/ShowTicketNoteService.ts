import TicketNote from "../../models/TicketNote";
import AppError from "../../errors/AppError";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

const ShowTicketNoteService = async (
  id: string | number,
  actor: ContextActor
): Promise<TicketNote> => {
  const ticketNote = await TicketNote.findByPk(id);

  if (!ticketNote) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  await AuthorizeTicketContextService(
    ticketNote.ticketId,
    actor,
    ticketNote.contactId
  );

  return ticketNote;
};

export default ShowTicketNoteService;
