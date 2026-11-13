import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";

const MAX_PREVIEW_LENGTH = 1200;

const ShowPendingMessagePreviewService = async (
  ticketId: string,
  actor: ContextActor
) => {
  const { ticket } = await AuthorizeTicketContextService(ticketId, actor);
  const message = await Message.findOne({
    attributes: ["body", "mediaType"],
    where: {
      companyId: actor.companyId,
      ticketId: ticket.id,
      fromMe: false,
      isDeleted: false,
      // Copied quotes from older versions are not inbound messages.
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
    ]
  });

  if (!message) return null;

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
    case "":
      return { kind: "text", text };
    default:
      return { kind: "attachment", text: "" };
  }
};

export default ShowPendingMessagePreviewService;
