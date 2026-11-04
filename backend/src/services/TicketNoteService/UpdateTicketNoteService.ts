import TicketNote from "../../models/TicketNote";
import { ContextActor } from "../TicketServices/AuthorizeTicketContextService";
import ShowTicketNoteService from "./ShowTicketNoteService";

interface TicketNoteData {
  note: string;
}

const UpdateTicketNoteService = async (
  id: string | number,
  ticketNoteData: TicketNoteData,
  actor: ContextActor
): Promise<TicketNote> => {
  const { note } = ticketNoteData;
  const ticketNote = await ShowTicketNoteService(id, actor);

  await ticketNote.update({
    note
  });

  return ticketNote;
};

export default UpdateTicketNoteService;
