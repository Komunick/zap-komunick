// Zap Komunick: the API owns authorization and byte validation; these checks
// keep malformed responses and protocol-specific payloads out of the viewer.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_TIMEOUT_MS = 30000;
export const validTicketId = value =>
  (typeof value === "number" ||
    (typeof value === "string" && /^[1-9]\d*$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;
const validMessageId = value =>
  typeof value === "string" && value.length > 0 && value.length <= 255;
export const attachmentIdentity = item =>
  String(item.sourceTicketId) + ":" + item.messageId;
export const attachmentPath = (ticketId, item) =>
  "/tickets/" +
  ticketId +
  "/attachments/" +
  item.sourceTicketId +
  "/" +
  encodeURIComponent(item.messageId);
export const validAttachment = item =>
  !!item &&
  validMessageId(item.messageId) &&
  validTicketId(item.sourceTicketId) &&
  typeof item.fileName === "string" &&
  item.fileName.length > 0 &&
  item.fileName.length <= 500 &&
  typeof item.createdAt === "string" &&
  item.createdAt.length <= 50 &&
  Number.isFinite(Date.parse(item.createdAt)) &&
  ["pdf", "image", "video", "other"].includes(item.kind) &&
  (item.sizeBytes === null ||
    (Number.isSafeInteger(item.sizeBytes) && item.sizeBytes >= 0)) &&
  ["local", "external", "unavailable"].includes(item.storage) &&
  typeof item.previewSupported === "boolean" &&
  ["available", "too_large", "unsupported", "external", "missing"].includes(
    item.previewReason
  ) &&
  (item.mimeType === null ||
    (typeof item.mimeType === "string" && item.mimeType.length <= 100)) &&
  (item.contentPath === null ||
    (typeof item.contentPath === "string" &&
      item.contentPath.length <= 2048)) &&
  (item.legacyUrl === null ||
    (typeof item.legacyUrl === "string" && item.legacyUrl.length <= 8192)) &&
  (item.previewSupported
    ? item.storage === "local" &&
      item.previewReason === "available" &&
      typeof item.contentPath === "string" &&
      previewMimeAllowed(item.kind, item.mimeType)
    : item.previewReason !== "available");
export const validAttachmentPage = data =>
  !!data &&
  Array.isArray(data.items) &&
  data.items.length <= 50 &&
  data.items.every(validAttachment) &&
  typeof data.hasMore === "boolean" &&
  (data.hasMore
    ? typeof data.nextCursor === "string" &&
      data.nextCursor.length > 0 &&
      data.nextCursor.length <= 4096
    : data.nextCursor === null) &&
  new Set(data.items.map(attachmentIdentity)).size === data.items.length;
export const safeOriginalUrl = value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};
export const attachmentError = error => {
  const status = error?.response?.status;
  if ([401, 403, 404].includes(status)) return "access";
  if (error?.code === "ERR_ATTACHMENT_TOO_LARGE") return "tooLarge";
  if (
    error?.code === "ERR_ATTACHMENT_TIMEOUT" ||
    error?.code === "ECONNABORTED"
  )
    return "timeout";
  return "failed";
};
export const failAttachment = code => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
export const previewMimeAllowed = (kind, mime) =>
  kind === "pdf"
    ? mime === "application/pdf"
    : kind === "image"
      ? ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)
      : kind === "video" && ["video/mp4", "video/webm"].includes(mime);
export const classifyMessageAttachment = (message, data) => {
  const document =
    data?.message?.documentMessage ||
    data?.message?.documentWithCaptionMessage?.message?.documentMessage;
  const mime = String(
    message.mimeType || message.mimetype || document?.mimetype || ""
  )
    .toLowerCase()
    .split(";")[0];
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  const isPdfName = value =>
    /\.pdf$/i.test(String(value || "").split(/[?#]/)[0]);
  if ([document?.fileName, message.fileName, message.mediaUrl].some(isPdfName))
    return "pdf";
  if (message.mediaType === "image") return "image";
  if (message.mediaType === "audio") return "audio";
  if (message.mediaType === "video") return "video";
  // Some legacy documents only retain the filename in the body. Captions of
  // positively typed image/video/audio messages must never change their kind.
  if (isPdfName(message.body)) return "pdf";
  return "other";
};

// Only eligible, currently loaded messages participate in local navigation.
export const buildMessageAttachments = (messages, contextKey) =>
  messages
    .filter(message => {
      if (
        !message.mediaUrl ||
        message.isDeleted ||
        !validTicketId(message.ticketId)
      )
        return false;
      let data;
      try {
        data = JSON.parse(message.dataJson);
      } catch {
        data = null;
      }
      return (
        !data?.message?.stickerMessage &&
        classifyMessageAttachment(message, data) !== "audio"
      );
    })
    .map(message => ({
      messageId: message.id,
      sourceTicketId: message.ticketId,
      fileName: message.body,
      version: [message.mediaUrl, message.updatedAt].join(":"),
      contextKey
    }));
