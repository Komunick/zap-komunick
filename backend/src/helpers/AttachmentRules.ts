import path from "path";
import AppError from "../errors/AppError";

export const MAX_ATTACHMENT_PREVIEW_BYTES = 26214400;
export type AttachmentKind = "pdf" | "image" | "video" | "other";
export interface AttachmentCursor {
  createdAt: string;
  id: string;
  ticketId: number;
}
const invalid = () => new AppError("ERR_ATTACHMENT_INVALID_REQUEST", 400);
export const attachmentId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > 255 ||
    /\p{Cc}/u.test(value)
  )
    throw invalid();
  return value;
};
export const attachmentTicketId = (value: unknown): number => {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw invalid();
  return Number(value);
};
export const parseAttachmentQuery = (
  query: Record<string, unknown>,
  list = false
) => {
  if (
    Object.keys(query).some(
      key => !list || !["kind", "cursor", "limit"].includes(key)
    )
  )
    throw invalid();
  const kind = query.kind === undefined ? "all" : query.kind;
  if (!["all", "pdf", "image", "video", "other"].includes(kind as string))
    throw invalid();
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (
    query.limit !== undefined &&
    (typeof query.limit !== "string" || !/^[1-9]\d*$/.test(query.limit))
  )
    throw invalid();
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw invalid();
  let cursor: AttachmentCursor | null = null;
  if (query.cursor !== undefined && query.cursor !== "") {
    if (
      typeof query.cursor !== "string" ||
      query.cursor.length > 1024 ||
      !/^[A-Za-z0-9_-]+$/.test(query.cursor)
    )
      throw invalid();
    try {
      const decoded = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8")
      );
      if (
        !decoded ||
        Object.keys(decoded).sort().join() !== "createdAt,id,ticketId" ||
        typeof decoded.createdAt !== "string" ||
        new Date(decoded.createdAt).toISOString() !== decoded.createdAt ||
        !Number.isSafeInteger(decoded.ticketId) ||
        decoded.ticketId <= 0
      )
        throw invalid();
      attachmentId(decoded.id);
      cursor = decoded;
    } catch {
      throw invalid();
    }
  }
  return { kind: kind as AttachmentKind | "all", limit, cursor };
};
export const encodeAttachmentCursor = (cursor: AttachmentCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export const attachmentKind = (value: string): AttachmentKind => {
  const ext = path.posix.extname(value.split(/[?#]/, 1)[0]).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".webm"].includes(ext)) return "video";
  return "other";
};
export const safeAttachmentName = (value: unknown): string => {
  if (typeof value !== "string") return "attachment";
  const basename = value
    .split(/[\\/]/)
    .pop()
    .replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, "_");
  return (
    Array.from(basename)
      .map(character =>
        character.length === 1 &&
        character.charCodeAt(0) >= 0xd800 &&
        character.charCodeAt(0) <= 0xdfff
          ? "_"
          : character
      )
      .slice(0, 180)
      .join("")
      .trim() || "attachment"
  );
};
export const attachmentFileName = (raw: string, dataJson?: string): string => {
  let name: unknown;
  if (typeof dataJson === "string" && dataJson.length <= 65536) {
    try {
      const data = JSON.parse(dataJson);
      let message = data?.message || data;
      for (let depth = 0; depth < 5 && message; depth += 1) {
        if (message?.documentMessage?.fileName) {
          name = message.documentMessage.fileName;
          break;
        }
        const wrapper = [
          "documentWithCaptionMessage",
          "ephemeralMessage",
          "viewOnceMessage",
          "viewOnceMessageV2"
        ].find(key => message?.[key]?.message);
        if (!wrapper) break;
        message = message[wrapper].message;
      }
    } catch {
      /* A legacy malformed payload does not prevent attachment listing. */
    }
  }
  if (typeof name === "string" && name.trim()) return safeAttachmentName(name);
  if (/^https?:\/\//i.test(raw)) {
    try {
      return safeAttachmentName(decodeURIComponent(new URL(raw).pathname));
    } catch {
      return "attachment";
    }
  }
  return safeAttachmentName(raw);
};
export const localAttachmentPath = (raw: string, companyId: number): string => {
  if (
    !raw ||
    raw.length > 4096 ||
    /[\p{Cc}\\]/u.test(raw) ||
    path.posix.isAbsolute(raw) ||
    /^[a-z][a-z0-9+.-]*:/i.test(raw) ||
    raw.split("/").some(part => part === "." || part === ".." || !part)
  )
    throw new AppError("ERR_ATTACHMENT_NOT_FOUND", 404);
  const parts = raw.split("/");
  // Older uploads can be a plain filename. Structured media paths must remain in this office.
  if (
    (parts[0] === "media" || parts[0] === "media-persistant") &&
    parts[1] !== String(companyId)
  )
    throw new AppError("ERR_ATTACHMENT_NOT_FOUND", 404);
  if (parts.length > 1 && !["media", "media-persistant"].includes(parts[0]))
    throw new AppError("ERR_ATTACHMENT_NOT_FOUND", 404);
  return raw;
};
export const detectedAttachmentMime = (
  bytes: Uint8Array,
  fileName: string
): string | null => {
  const text = (start: number, end: number) =>
    Array.from(bytes.slice(start, end))
      .map(byte => String.fromCharCode(byte))
      .join("");
  const starts = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const ext = path.posix.extname(fileName).toLowerCase();
  if (ext === ".pdf" && text(0, 5) === "%PDF-") return "application/pdf";
  if (ext === ".png" && starts([137, 80, 78, 71, 13, 10, 26, 10]))
    return "image/png";
  if ([".jpg", ".jpeg"].includes(ext) && starts([255, 216, 255]))
    return "image/jpeg";
  if (ext === ".gif" && ["GIF87a", "GIF89a"].includes(text(0, 6)))
    return "image/gif";
  if (ext === ".webp" && text(0, 4) === "RIFF" && text(8, 12) === "WEBP")
    return "image/webp";
  if (
    ext === ".mp4" &&
    text(4, 8) === "ftyp" &&
    [
      "isom",
      "iso2",
      "iso3",
      "iso4",
      "iso5",
      "iso6",
      "mp41",
      "mp42",
      "avc1",
      "M4V ",
      "dash"
    ].includes(text(8, 12))
  )
    return "video/mp4";
  if (
    ext === ".webm" &&
    starts([26, 69, 223, 163]) &&
    text(4, 512).includes("webm")
  )
    return "video/webm";
  return null;
};
export const attachmentRange = (
  header: unknown,
  size: number
): { start: number; end: number; partial: boolean } => {
  if (header === undefined) return { start: 0, end: size - 1, partial: false };
  if (
    typeof header !== "string" ||
    !/^bytes=(\d*)-(\d*)$/.test(header) ||
    size <= 0
  )
    throw new AppError("ERR_ATTACHMENT_RANGE", 416);
  const [, from, to] = /^bytes=(\d*)-(\d*)$/.exec(header);
  let start: number;
  let end: number;
  if (!from) {
    const suffix = Number(to);
    if (!Number.isSafeInteger(suffix) || suffix <= 0)
      throw new AppError("ERR_ATTACHMENT_RANGE", 416);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(from);
    end = to ? Math.min(Number(to), size - 1) : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      (to && !Number.isSafeInteger(Number(to))) ||
      start >= size ||
      start > end
    )
      throw new AppError("ERR_ATTACHMENT_RANGE", 416);
  }
  return { start, end, partial: true };
};
export const attachmentDisposition = (name: string): string =>
  `inline; filename="${safeAttachmentName(name).replace(/[^a-zA-Z0-9._ -]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeAttachmentName(name)).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
