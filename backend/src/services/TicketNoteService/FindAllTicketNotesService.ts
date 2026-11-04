import TicketNote from "../../models/TicketNote";
import {
  ContextActor,
  loadTicketViewer
} from "../TicketServices/AuthorizeTicketContextService";
import { ticketNoteScope } from "./TicketNoteScope";

const FindAllTicketNotesService = async (
  actor: ContextActor
): Promise<TicketNote[]> => {
  const viewer = await loadTicketViewer(actor);
  const ticketNote = await TicketNote.findAll({
    include: ticketNoteScope(viewer)
  });
  return ticketNote;
};

export default FindAllTicketNotesService;
