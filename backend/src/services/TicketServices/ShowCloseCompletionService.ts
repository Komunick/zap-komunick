import { GetCompanySetting } from "../../helpers/CheckSettings";
import {
  COMPLETION_PROMPT_SETTING,
  completionPromptEnabled,
  completionTextOnClose
} from "../../helpers/CloseCompletion";
import IsWhatsAppQueueLinked from "../../helpers/IsWhatsAppQueueLinked";
import formatBody from "../../helpers/Mustache";
import AuthorizeTicketContextService, {
  ContextActor
} from "./AuthorizeTicketContextService";
import ShowTicketService from "./ShowTicketService";
import { logger } from "../../utils/logger";

// Zap Komunick: what the screen needs to know before finishing a ticket
// (docs/PRD.md, RF-034): must the person be asked about the completion
// message, and what exactly would the client receive.

export interface CloseCompletion {
  // ask whoever finishes whether the message goes
  ask: boolean;
  // the text the client would receive, already with the names filled in
  message: string | null;
}

const NOTHING_TO_ASK: CloseCompletion = { ask: false, message: null };

const ShowCloseCompletionService = async (
  ticketId: string | number,
  actor: ContextActor
): Promise<CloseCompletion> => {
  await AuthorizeTicketContextService(ticketId, actor);
  const { companyId } = actor;

  if (
    !completionPromptEnabled(
      await GetCompanySetting(companyId, COMPLETION_PROMPT_SETTING, "disabled")
    )
  ) {
    return NOTHING_TO_ASK;
  }
  // With the rating request on, the end of a ticket belongs to the rating
  // flow: it asks for the grade first and sends the completion message itself.
  if (
    (await GetCompanySetting(companyId, "userRating", "disabled")) === "enabled"
  ) {
    return NOTHING_TO_ASK;
  }

  const ticket = await ShowTicketService(ticketId, companyId);
  if (!ticket || ticket.status === "closed") return NOTHING_TO_ASK;

  const text = completionTextOnClose({
    channel: ticket.channel,
    // the same rule as the finish itself (UpdateTicketService)
    isGroup: ticket.contact?.isGroup || ticket.isGroup,
    contactDisableBot: ticket.contact?.disableBot,
    whatsappStatus: ticket.whatsapp?.status,
    completionMessage: ticket.whatsapp?.complationMessage
  });
  if (!text) return NOTHING_TO_ASK;
  // same door as the finish itself: a sector that does not answer through
  // this connection sends nothing by it
  if (
    ticket.queueId &&
    !(await IsWhatsAppQueueLinked(
      ticket.companyId,
      ticket.whatsappId,
      ticket.queueId
    ))
  ) {
    return NOTHING_TO_ASK;
  }

  // A text with a broken tag cannot be shown, nor sent: there is nothing to
  // ask, and the Finish button must keep working without it.
  try {
    return { ask: true, message: formatBody(text, ticket) };
  } catch (error) {
    logger.warn(
      { ticketId: ticket.id, message: (error as Error)?.message },
      "The completion message could not be formatted."
    );
    return NOTHING_TO_ASK;
  }
};

export default ShowCloseCompletionService;
