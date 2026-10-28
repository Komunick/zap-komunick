import { col, fn, Op, WhereOptions, where } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import {
  attachmentFileName,
  attachmentId,
  attachmentKind,
  attachmentTicketId,
  AttachmentCursor,
  AttachmentKind,
  encodeAttachmentCursor,
  MAX_ATTACHMENT_PREVIEW_BYTES,
  parseAttachmentQuery
} from "../../helpers/AttachmentRules";
import { URLCharEncoder } from "../../helpers/URLCharEncoder";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../MessageServices/AuthorizeMessageContextService";
import { openAttachmentFile } from "./AttachmentFileService";

export interface AttachmentDTO {
  messageId: string;
  sourceTicketId: number;
  createdAt: string;
  fileName: string;
  kind: AttachmentKind;
  sizeBytes: number | null;
  mimeType: string | null;
  storage: "local" | "external" | "unavailable";
  previewSupported: boolean;
  previewReason:
    "available" | "too_large" | "unsupported" | "external" | "missing";
  contentPath: string | null;
  legacyUrl: string | null;
}
const errors = new Set([
  "ERR_NO_PERMISSION",
  "ERR_NO_TICKET_FOUND",
  "ERR_MESSAGE_NOT_FOUND",
  "ERR_ATTACHMENT_NOT_FOUND",
  "ERR_ATTACHMENT_INVALID_REQUEST",
  "ERR_ATTACHMENT_CONTEXT_CHANGED",
  "ERR_ATTACHMENT_TOO_LARGE",
  "ERR_ATTACHMENT_UNSUPPORTED"
]);
const protect = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && errors.has(error.message)) throw error;
    throw new AppError("ERR_ATTACHMENT_UNAVAILABLE", 503);
  }
};
const scope = async (ticketId: string, actor: ContextActor) => {
  attachmentTicketId(ticketId);
  const { ticket, viewer } = await AuthorizeTicketContextService(
    ticketId,
    actor
  );
  const visibility = await GetCompanySetting(
    actor.companyId,
    "messageVisibility",
    "message"
  );
  return {
    ticket,
    viewer,
    visibility,
    fingerprint: JSON.stringify([
      ticket.id,
      ticket.contactId,
      ticket.queueId,
      ticket.isGroup,
      viewer.isAdmin,
      [...viewer.queueIds].sort((a, b) => a - b),
      visibility
    ])
  };
};
type Scope = Awaited<ReturnType<typeof scope>>;
const conditions = (state: Scope, companyId: number): WhereOptions[] => {
  const result: WhereOptions[] = [
    { companyId, isDeleted: false },
    { mediaUrl: { [Op.ne]: null } },
    { mediaUrl: { [Op.ne]: "" } },
    {
      [Op.or]: [
        { mediaType: null },
        { mediaType: { [Op.notIn]: ["reactionMessage", "transferNote"] } }
      ]
    }
  ];
  // Same RF-017 fence as ListMessagesService: transfers preserve the current
  // ticket, while historical messages retain their queue visibility.
  if (!state.viewer.isAdmin && state.visibility === "message")
    result.push({
      [Op.or]: [
        { ticketId: state.ticket.id },
        { queueId: null },
        { queueId: { [Op.in]: state.viewer.queueIds } }
      ]
    });
  return result;
};
const attributes = [
  "id",
  "ticketId",
  "companyId",
  "queueId",
  "mediaUrl",
  "mediaType",
  "dataJson",
  "createdAt",
  "updatedAt",
  "isDeleted"
];
const queryOptions = (
  state: Scope,
  companyId: number,
  extra: WhereOptions[] = []
) => ({
  where: { [Op.and]: [...conditions(state, companyId), ...extra] },
  attributes,
  include: [
    {
      model: Ticket,
      as: "ticket",
      attributes: [],
      required: true,
      where: { companyId, contactId: state.ticket.contactId }
    }
  ],
  logging: false as const
});
const raw = (message: Message): string => message.getDataValue("mediaUrl");
const stamp = (message: Message): string =>
  JSON.stringify([
    message.id,
    message.ticketId,
    message.companyId,
    message.queueId,
    raw(message),
    message.mediaType,
    message.isDeleted,
    new Date(message.updatedAt).toISOString(),
    message.dataJson
  ]);
const identity = (message: Message) => ({
  id: message.id,
  ticketId: message.ticketId
});
const cursorOf = (message: Message): AttachmentCursor => ({
  createdAt: new Date(message.createdAt).toISOString(),
  id: message.id,
  ticketId: message.ticketId
});
// JS Date and the public cursor have millisecond precision, while PostgreSQL's
// column may contain microseconds. Sort and seek at the same precision so ties
// cannot be skipped between pages.
const cursorDate = () =>
  fn("date_trunc", "milliseconds", col("Message.createdAt"));
const keyset = (cursor: AttachmentCursor): WhereOptions => ({
  [Op.or]: [
    where(cursorDate(), { [Op.lt]: cursor.createdAt }),
    {
      [Op.and]: [
        where(cursorDate(), cursor.createdAt),
        { id: { [Op.lt]: cursor.id } }
      ]
    },
    {
      [Op.and]: [
        where(cursorDate(), cursor.createdAt),
        { id: cursor.id, ticketId: { [Op.lt]: cursor.ticketId } }
      ]
    }
  ]
});
const kindCondition = (kind: AttachmentKind): WhereOptions => {
  const extensions = {
    pdf: "pdf",
    image: "png|jpe?g|gif|webp",
    video: "mp4|webm",
    other: "pdf|png|jpe?g|gif|webp|mp4|webm"
  };
  return where(fn("lower", col("Message.mediaUrl")), {
    [kind === "other" ? Op.notRegexp : Op.regexp]:
      `\\.(${extensions[kind]})([?#].*)?$`
  });
};
const legacyUrl = (value: string): string | null => {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.username || url.password ? null : url.toString();
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return `${process.env.BACKEND_URL}/public/${URLCharEncoder(value)}`;
};
const metadata = async (
  message: Message,
  ticketId: string,
  companyId: number
): Promise<AttachmentDTO> => {
  const value = raw(message);
  const dto: AttachmentDTO = {
    messageId: message.id,
    sourceTicketId: message.ticketId,
    createdAt: new Date(message.createdAt).toISOString(),
    fileName: attachmentFileName(value, message.dataJson),
    kind: attachmentKind(value),
    sizeBytes: null,
    mimeType: null,
    storage: "unavailable",
    previewSupported: false,
    previewReason: "missing",
    contentPath: null,
    legacyUrl: legacyUrl(value)
  };
  if (/^https?:\/\//i.test(value))
    return { ...dto, storage: "external", previewReason: "external" };
  try {
    const file = await openAttachmentFile(value, companyId);
    await file.handle.close();
    dto.storage = "local";
    dto.sizeBytes = file.size;
    dto.mimeType = file.mimeType;
    dto.previewReason =
      file.size > MAX_ATTACHMENT_PREVIEW_BYTES
        ? "too_large"
        : !file.mimeType
          ? "unsupported"
          : "available";
    dto.previewSupported = dto.previewReason === "available";
    if (dto.previewSupported)
      dto.contentPath = `/tickets/${ticketId}/attachments/${message.ticketId}/${encodeURIComponent(message.id)}/content`;
  } catch (error) {
    if (
      !(error instanceof AppError) ||
      error.message !== "ERR_ATTACHMENT_NOT_FOUND"
    )
      throw error;
    dto.legacyUrl = null;
  }
  return dto;
};
const revalidate = async (
  ticketId: string,
  actor: ContextActor,
  before: Scope,
  messages: Message[]
) => {
  const after = await scope(ticketId, actor);
  if (after.fingerprint !== before.fingerprint)
    throw new AppError("ERR_ATTACHMENT_CONTEXT_CHANGED", 409);
  if (!messages.length) return;
  const current = await Message.findAll(
    queryOptions(after, actor.companyId, [{ [Op.or]: messages.map(identity) }])
  );
  if (
    current.length !== messages.length ||
    messages.some(
      message =>
        !current.some(
          row =>
            row.id === message.id &&
            row.ticketId === message.ticketId &&
            stamp(row) === stamp(message)
        )
    )
  )
    throw new AppError("ERR_ATTACHMENT_CONTEXT_CHANGED", 409);
};

export const listTicketAttachments = (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protect(async () => {
    const parsed = parseAttachmentQuery(query, true);
    const state = await scope(ticketId, actor);
    const extra: WhereOptions[] = [];
    if (parsed.cursor) extra.push(keyset(parsed.cursor));
    if (parsed.kind !== "all") extra.push(kindCondition(parsed.kind));
    const rows = await Message.findAll({
      ...queryOptions(state, actor.companyId, extra),
      order: [
        [cursorDate(), "DESC"],
        ["id", "DESC"],
        ["ticketId", "DESC"]
      ],
      limit: parsed.limit + 1
    });
    const page = rows.slice(0, parsed.limit);
    const snapshots = page.map(stamp);
    const items = await Promise.all(
      page.map(row => metadata(row, ticketId, actor.companyId))
    );
    // Detached snapshots are needed even when an ORM/mock returns the same mutable object.
    if (page.some((row, index) => stamp(row) !== snapshots[index]))
      throw new AppError("ERR_ATTACHMENT_CONTEXT_CHANGED", 409);
    await revalidate(ticketId, actor, state, page);
    const hasMore = rows.length > parsed.limit;
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && page.length
          ? encodeAttachmentCursor(cursorOf(page[page.length - 1]))
          : null
    };
  });

const load = async (
  ticketId: string,
  actor: ContextActor,
  sourceId: string,
  messageId: string,
  query: Record<string, unknown>
) => {
  parseAttachmentQuery(query);
  const sourceTicketId = attachmentTicketId(sourceId);
  attachmentId(messageId);
  const state = await scope(ticketId, actor);
  await AuthorizeMessageContextService(
    messageId,
    actor,
    ticketId,
    sourceTicketId
  );
  const message = await Message.findOne(
    queryOptions(state, actor.companyId, [
      { id: messageId, ticketId: sourceTicketId }
    ])
  );
  if (!message) throw new AppError("ERR_ATTACHMENT_NOT_FOUND", 404);
  return { state, message, snapshot: stamp(message) };
};
export const getTicketAttachment = (
  ticketId: string,
  actor: ContextActor,
  sourceId: string,
  messageId: string,
  query: Record<string, unknown>
) =>
  protect(async () => {
    const { state, message, snapshot } = await load(
      ticketId,
      actor,
      sourceId,
      messageId,
      query
    );
    const result = await metadata(message, ticketId, actor.companyId);
    if (stamp(message) !== snapshot)
      throw new AppError("ERR_ATTACHMENT_CONTEXT_CHANGED", 409);
    await revalidate(ticketId, actor, state, [message]);
    return result;
  });
export const openTicketAttachment = (
  ticketId: string,
  actor: ContextActor,
  sourceId: string,
  messageId: string,
  query: Record<string, unknown>
) =>
  protect(async () => {
    const { state, message, snapshot } = await load(
      ticketId,
      actor,
      sourceId,
      messageId,
      query
    );
    if (/^https?:\/\//i.test(raw(message)))
      throw new AppError("ERR_ATTACHMENT_UNSUPPORTED", 415);
    const file = await openAttachmentFile(raw(message), actor.companyId);
    try {
      if (file.size > MAX_ATTACHMENT_PREVIEW_BYTES)
        throw new AppError("ERR_ATTACHMENT_TOO_LARGE", 413);
      if (!file.mimeType) throw new AppError("ERR_ATTACHMENT_UNSUPPORTED", 415);
      if (stamp(message) !== snapshot)
        throw new AppError("ERR_ATTACHMENT_CONTEXT_CHANGED", 409);
      await revalidate(ticketId, actor, state, [message]);
      return {
        ...file,
        fileName: attachmentFileName(raw(message), message.dataJson)
      };
    } catch (error) {
      await file.handle.close().catch(() => undefined);
      throw error;
    }
  });
