import AppError from "../errors/AppError";

// Zap Komunick: rules of the support tickets (docs/PRD.md, RF-030).
export const SUPPORT_MAX_FILES = 5;
export const SUPPORT_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const SUPPORT_TICKETS_PER_HOUR = 10;
export const SUPPORT_MESSAGES_PER_HOUR = 120;
export const SUPPORT_TITLE_MAX = 140;
export const SUPPORT_LOCATION_MAX = 200;
export const SUPPORT_BODY_MAX = 4000;

export const SUPPORT_CATEGORIES = [
  "error",
  "wrong_data",
  "question",
  "access",
  "suggestion",
  "other"
] as const;
export const SUPPORT_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical"
] as const;
export const SUPPORT_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "done",
  "cancelled"
] as const;
export const SUPPORT_ACTIONS = [
  "take",
  "request_info",
  "resume",
  "conclude",
  "reopen",
  "cancel"
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export type SupportAction = (typeof SUPPORT_ACTIONS)[number];

export const isSupportFinished = (status: string): boolean =>
  status === "done" || status === "cancelled";

export const supportNumber = (id: number): string =>
  `CH-${String(id).padStart(6, "0")}`;

const invalid = () => new AppError("ERR_SUPPORT_INVALID", 400);

export const supportOption = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback?: T
): T => {
  if ((value === undefined || value === null || value === "") && fallback)
    return fallback;
  if (typeof value !== "string" || !options.includes(value as T))
    throw invalid();
  return value as T;
};

/**
 * Text field: a string within the limit, without control characters other
 * than line breaks and tabs.
 */
export const supportText = (
  value: unknown,
  max: number,
  required: boolean
): string => {
  if (value === undefined || value === null || value === "") {
    if (required) throw invalid();
    return "";
  }
  if (typeof value !== "string") throw invalid();
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .trim();
  if (text.length > max || (required && !text.length)) throw invalid();
  return text;
};

export const supportTicketId = (value: unknown): number => {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value))
    throw new AppError("ERR_SUPPORT_TICKET_NOT_FOUND", 404);
  return Number(value);
};

export interface SupportFileType {
  kind: "image" | "video" | "pdf";
  mimeType: string;
  extension: string;
}

const startsWith = (bytes: Buffer, signature: number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string): number[] =>
  Array.from(text).map(character => character.charCodeAt(0));

/**
 * Type of an attachment taken from its first bytes. The name and the type the
 * browser sends are chosen by whoever uploads the file, so they do not count.
 */
export const supportFileType = (bytes: Buffer): SupportFileType | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { kind: "image", mimeType: "image/png", extension: ".png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { kind: "image", mimeType: "image/jpeg", extension: ".jpg" };
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a")))
    return { kind: "image", mimeType: "image/gif", extension: ".gif" };
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8))
    return { kind: "image", mimeType: "image/webp", extension: ".webp" };
  if (startsWith(bytes, ascii("%PDF-")))
    return { kind: "pdf", mimeType: "application/pdf", extension: ".pdf" };
  if (startsWith(bytes, ascii("ftyp"), 4))
    return startsWith(bytes, ascii("qt  "), 8)
      ? { kind: "video", mimeType: "video/quicktime", extension: ".mov" }
      : { kind: "video", mimeType: "video/mp4", extension: ".mp4" };
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]))
    return { kind: "video", mimeType: "video/webm", extension: ".webm" };
  return null;
};

interface ActionInput {
  action: SupportAction;
  status: SupportStatus;
  isSupport: boolean;
  isRequester: boolean;
}

interface ActionResult {
  status: SupportStatus;
  // The text becomes a public message stored together with the new status.
  needsText: boolean;
  // Whoever acts becomes the person in charge.
  assign: "always" | "if-empty" | "never";
}

const notAllowed = () => new AppError("ERR_SUPPORT_ACTION_NOT_ALLOWED", 409);

/**
 * What each button does, as in the Brazil TMS ticket desk: support takes,
 * asks for information, concludes and reopens; the requester can only cancel
 * a ticket nobody has taken yet.
 */
export const supportActionResult = ({
  action,
  status,
  isSupport,
  isRequester
}: ActionInput): ActionResult => {
  if (action === "cancel") {
    if (status !== "open" || (!isSupport && !isRequester)) throw notAllowed();
    return { status: "cancelled", needsText: true, assign: "never" };
  }
  if (!isSupport) throw new AppError("ERR_NO_PERMISSION", 403);
  if (action === "take" && status === "open")
    return { status: "in_progress", needsText: false, assign: "always" };
  if (
    action === "request_info" &&
    (status === "open" || status === "in_progress")
  )
    return { status: "waiting", needsText: true, assign: "if-empty" };
  if (action === "resume" && status === "waiting")
    return { status: "in_progress", needsText: false, assign: "if-empty" };
  if (action === "conclude" && !isSupportFinished(status))
    return { status: "done", needsText: true, assign: "if-empty" };
  if (action === "reopen" && isSupportFinished(status))
    return { status: "in_progress", needsText: false, assign: "if-empty" };
  throw notAllowed();
};

interface MessageInput {
  status: SupportStatus;
  fromSupport: boolean;
  hasAssignee: boolean;
}

/**
 * Status after a message. Writing in a finished ticket reopens it, with no
 * deadline: this is how the conversation continues after support is over.
 */
export const supportStatusAfterMessage = ({
  status,
  fromSupport,
  hasAssignee
}: MessageInput): { status: SupportStatus; reopened: boolean } => {
  if (isSupportFinished(status))
    return {
      status: fromSupport || hasAssignee ? "in_progress" : "open",
      reopened: true
    };
  if (fromSupport)
    return {
      status: status === "open" ? "in_progress" : status,
      reopened: false
    };
  return {
    status: status === "waiting" ? "in_progress" : status,
    reopened: false
  };
};
