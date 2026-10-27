import TicketNote from "../../models/TicketNote";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import { ticketNoteScope } from "./TicketNoteScope";

interface Params {
  actor: ContextActor;
  contactId: number | string;
  ticketId: number | string;
}

const FindNotesByContactIdAndTicketId = async ({
  contactId,
  ticketId,
  actor
}: Params): Promise<TicketNote[]> => {
  const { viewer } = await AuthorizeTicketContextService(
    ticketId,
    actor,
    contactId
  );
  const notes: TicketNote[] = await TicketNote.findAll({
    where: {
      contactId,
      ticketId
    },
    include: ticketNoteScope(viewer),
    order: [["createdAt", "DESC"]]
  });

  return notes;
};

export default FindNotesByContactIdAndTicketId;
