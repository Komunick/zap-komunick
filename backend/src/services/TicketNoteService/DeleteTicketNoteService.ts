import AppError from "../../errors/AppError";
import {
  ContextActor,
  loadTicketViewer
} from "../TicketServices/AuthorizeTicketContextService";
import ShowTicketNoteService from "./ShowTicketNoteService";

const DeleteTicketNoteService = async (
  id: string,
  actor: ContextActor
): Promise<void> => {
  const viewer = await loadTicketViewer(actor);
  if (!viewer.isAdmin) throw new AppError("ERR_NO_PERMISSION", 403);
  const ticketnote = await ShowTicketNoteService(id, actor);

  await ticketnote.destroy();
};

export default DeleteTicketNoteService;
