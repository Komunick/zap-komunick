import * as Yup from "yup";
import AppError from "../../errors/AppError";
import TicketNote from "../../models/TicketNote";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

interface TicketNoteData {
  note: string;
  contactId: number;
  ticketId: number;
}

const CreateTicketNoteService = async (
  ticketNoteData: TicketNoteData,
  actor: ContextActor
): Promise<TicketNote> => {
  const { note } = ticketNoteData;

  const ticketnoteSchema = Yup.object().shape({
    note: Yup.string()
      .min(3, "ERR_TICKETNOTE_INVALID_NAME")
      .required("ERR_TICKETNOTE_INVALID_NAME")
  });

  try {
    await ticketnoteSchema.validate({ note });
  } catch (err) {
    throw new AppError(err.message);
  }

  const { ticket } = await AuthorizeTicketContextService(
    ticketNoteData.ticketId,
    actor,
    ticketNoteData.contactId
  );
  const ticketNote = await TicketNote.create({
    note,
    userId: Number(actor.userId),
    contactId: ticket.contactId,
    ticketId: ticket.id
  });

  return ticketNote;
};

export default CreateTicketNoteService;
