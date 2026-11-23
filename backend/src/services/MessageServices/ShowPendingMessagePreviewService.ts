import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

const MAX_PREVIEW_LENGTH = 1200;
// Zap Komunick: the whole conversation of the pending ticket. The cap only
// protects the dialog from an unusually long ticket; the newest stay.
export const MAX_PREVIEW_MESSAGES = 500;

export type PreviewKind =
  "text" | "image" | "video" | "audio" | "attachment" | "contact" | "location";

export interface PreviewItem {
  id: string;
  fromMe: boolean;
  createdAt: Date;
  kind: PreviewKind;
  text: string;
}

export interface PendingConversationPreview {
  messages: PreviewItem[];
  truncated: boolean;
}

// Projects one stored message into what the preview may show. Audio
// transcripts and raw cards never leave the server.
export const projectPreviewMessage = (message: {
  body?: string | null;
  mediaType?: string | null;
}): { kind: PreviewKind; text: string } => {
  const body = message.body?.trim() || "";
  if (body.startsWith('{"ticketzvCard":')) return { kind: "contact", text: "" };
  if (body.startsWith("data:image/")) return { kind: "location", text: "" };

  const text =
    body.length > MAX_PREVIEW_LENGTH
      ? `${body.slice(0, MAX_PREVIEW_LENGTH).replace(/[\uD800-\uDBFF]$/, "")}…`
      : body;

  switch (message.mediaType) {
    case "image":
    case "video":
      return { kind: message.mediaType, text };
    case "audio":
      return { kind: "audio", text: "" };
    case null:
    case undefined:
    case "":
      return { kind: "text", text };
    default:
      return { kind: "attachment", text: "" };
  }
};

// Read-only: it never marks messages as read nor changes the ticket. Only
// "Aceitar e abrir" (PUT /tickets/:id) moves the ticket out of pending.
const ShowPendingMessagePreviewService = async (
  ticketId: string,
  actor: ContextActor
): Promise<PendingConversationPreview> => {
  const { ticket } = await AuthorizeTicketContextService(ticketId, actor);
  const rows = await Message.findAll({
    attributes: ["id", "body", "mediaType", "fromMe", "createdAt"],
    where: {
      companyId: actor.companyId,
      ticketId: ticket.id,
      isDeleted: false,
      // Copied quotes from older versions are not part of the conversation.
      id: { [Op.notLike]: `%-${ticket.id}` },
      [Op.or]: [
        { mediaType: null },
        { mediaType: { [Op.notIn]: ["reactionMessage", "transferNote"] } }
      ]
    },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: [],
        required: true,
        where: {
          companyId: actor.companyId,
          status: "pending",
          queueId: ticket.queueId
        }
      }
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: MAX_PREVIEW_MESSAGES + 1
  });

  const truncated = rows.length > MAX_PREVIEW_MESSAGES;
  const messages = rows
    .slice(0, MAX_PREVIEW_MESSAGES)
    .reverse()
    .map(row => ({
      id: row.id,
      fromMe: !!row.fromMe,
      createdAt: row.createdAt,
      ...projectPreviewMessage(row)
    }));

  return { messages, truncated };
};

export default ShowPendingMessagePreviewService;
