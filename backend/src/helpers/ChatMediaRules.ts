import { positiveChatId } from "./ChatAuthorization";
import path from "path";
import { detectedAttachmentMime } from "./AttachmentRules";

export const CHAT_MEDIA_SIGNATURE_BYTES = 512;

export function hasChatMediaControlCharacters(value: string): boolean {
  return Array.from(value).some(
    character =>
      character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127
  );
}

// Zap Komunick: storage names are data, never request-controlled paths.
export function chatMediaBasename(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith(".") ||
    /[/\\]/.test(value) ||
    hasChatMediaControlCharacters(value) ||
    Buffer.byteLength(value, "utf8") > 255
  )
    return undefined;
  return value;
}

export function publicChatMediaReference(
  value: unknown,
  backendUrl: string,
  frontendUrl?: string
): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (value.startsWith("{") || value.startsWith("[")) return undefined;
  // File settings may contain a JSON string, never inspect unrelated objects.
  if (value.startsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      return typeof decoded === "string"
        ? publicChatMediaReference(decoded, backendUrl, frontendUrl)
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (chatMediaBasename(value) && !/^https?:/i.test(value)) return value;
  let pathname: string;
  let base: URL;
  let frontend: URL;
  try {
    base = new URL(backendUrl);
  } catch {
    base = new URL("http://backend.invalid");
  }
  try {
    frontend = frontendUrl ? new URL(frontendUrl) : undefined;
  } catch {
    frontend = undefined;
  }
  try {
    if (/^https?:\/\//i.test(value)) {
      const address = new URL(value);
      if (address.origin !== base.origin && address.origin !== frontend?.origin)
        return undefined;
      pathname = address.pathname;
    } else pathname = value.split(/[?#]/, 1)[0];
    const prefixes = [
      "/public/",
      "/backend/public/",
      ...(frontend
        ? [`${frontend.pathname.replace(/\/+$/, "")}/backend/public/`]
        : []),
      `${base.pathname.replace(/\/+$/, "")}/public/`
    ];
    const prefix = prefixes.find(candidate => pathname.startsWith(candidate));
    if (!prefix) return undefined;
    return chatMediaBasename(decodeURIComponent(pathname.slice(prefix.length)));
  } catch {
    return undefined;
  }
}

export function isChatUploadName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-zA-Z0-9]{1,32})?$/.test(
      value
    )
  );
}

export function chatMediaUrl(
  chatId: unknown,
  messageId: unknown,
  backendUrl: string
): string | null {
  const chat = positiveChatId(chatId),
    message = positiveChatId(messageId);
  return chat && message
    ? `${backendUrl.replace(/\/+$/, "")}/chats/${chat}/messages/${message}/media`
    : null;
}

const INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/flac",
  "audio/x-flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime"
]);

export function chatMediaDelivery(
  mimeType: string | false,
  forceDownload: boolean
): { contentType: string; inline: boolean } {
  const safe = typeof mimeType === "string" && INLINE_TYPES.has(mimeType);
  return {
    contentType: safe ? mimeType : "application/octet-stream",
    inline: safe && !forceDownload
  };
}

// A bounded format check preserves native legacy media without trusting a
// display name or a client MIME. It is not a content or malware scanner.
export function detectedChatMediaMime(
  bytes: Uint8Array,
  storageName: string,
  category?: string
): string | null {
  const ext = path.posix.extname(storageName).toLowerCase();
  const allowed = (...extensions: string[]) => !ext || extensions.includes(ext);
  const text = (from: number, to: number) =>
    Array.from(bytes.slice(from, to))
      .map(byte => String.fromCharCode(byte))
      .join("");
  const common = [[".pdf"], [".png"], [".jpg", ".jpeg"], [".gif"], [".webp"]];
  for (let index = 0; index < common.length; index += 1) {
    const extensions = common[index];
    if (allowed(...extensions)) {
      const detected = detectedAttachmentMime(
        bytes,
        `attachment${extensions[0]}`
      );
      if (detected) return detected;
    }
  }
  if (
    allowed(".bmp") &&
    bytes.length >= 18 &&
    text(0, 2) === "BM" &&
    [12, 40, 52, 56, 64, 108, 124].includes(
      bytes[14] + (bytes[15] << 8) + (bytes[16] << 16) + (bytes[17] << 24)
    )
  )
    return "image/bmp";
  if (text(4, 8) === "ftyp") {
    const brand = text(8, 12);
    if (allowed(".avif") && ["avif", "avis"].includes(brand))
      return "image/avif";
    if (allowed(".mov") && brand === "qt  ") return "video/quicktime";
    if (
      allowed(".mp4", ".m4a") &&
      (detectedAttachmentMime(bytes, "attachment.mp4") ||
        ["M4A ", "M4B "].includes(brand))
    )
      return category === "audio" ||
        ext === ".m4a" ||
        ["M4A ", "M4B "].includes(brand)
        ? "audio/mp4"
        : "video/mp4";
  }
  if (allowed(".webm") && detectedAttachmentMime(bytes, "attachment.webm"))
    return category === "audio" ? "audio/webm" : "video/webm";
  if (
    allowed(".ogg", ".oga", ".opus", ".ogv") &&
    text(0, 4) === "OggS" &&
    bytes[4] === 0
  )
    return category === "video" || ext === ".ogv" ? "video/ogg" : "audio/ogg";
  if (
    allowed(".wav", ".wave") &&
    text(0, 4) === "RIFF" &&
    text(8, 12) === "WAVE"
  )
    return "audio/wav";
  if (allowed(".flac") && text(0, 4) === "fLaC") return "audio/flac";
  const mpegFrame =
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    (bytes[1] & 224) === 224 &&
    ((bytes[1] >> 3) & 3) !== 1 &&
    ((bytes[1] >> 1) & 3) !== 0 &&
    bytes[2] >> 4 !== 0 &&
    bytes[2] >> 4 !== 15 &&
    ((bytes[2] >> 2) & 3) !== 3;
  if (
    allowed(".mp3", ".mpeg") &&
    ((text(0, 3) === "ID3" && [2, 3, 4].includes(bytes[3])) || mpegFrame)
  )
    return "audio/mpeg";
  if (
    allowed(".aac") &&
    bytes.length >= 7 &&
    bytes[0] === 255 &&
    (bytes[1] & 246) === 240 &&
    ((bytes[2] >> 2) & 15) < 13
  )
    return "audio/aac";
  return null;
}

export function hasChatMediaMigrationConflict(inventory: {
  invalidReferences: number;
  unsafeStorage: boolean;
  files: { public: boolean; problem?: string; sharedTables: string[] }[];
}): boolean {
  return (
    inventory.unsafeStorage ||
    inventory.invalidReferences > 0 ||
    inventory.files.some(
      file => !!file.problem || (file.public && file.sharedTables.length > 0)
    )
  );
}
