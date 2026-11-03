// Zap Komunick: chat media is addressed by authorized message identity, never
// by the legacy public storage name supplied in an older message snapshot.
const positiveId = value =>
  (typeof value === "number" ||
    (typeof value === "string" && /^[1-9]\d*$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

export const chatMediaPath = (chatId, messageId, download = false) =>
  positiveId(chatId) && positiveId(messageId)
    ? `/chats/${chatId}/messages/${messageId}/media${download ? "?download=1" : ""}`
    : null;

export function chatMediaUrl(backendUrl, chatId, messageId, download = false) {
  const path = chatMediaPath(chatId, messageId, download);
  if (!path) return null;
  try {
    const base = new URL(backendUrl);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return null;
    return base.href.replace(/\/+$/, "") + path;
  } catch {
    return null;
  }
}

export function releaseChatMedia(node) {
  if (!node) return;
  const player = ["AUDIO", "VIDEO"].includes(node.tagName);
  if (player) node.pause();
  node.removeAttribute("src");
  node
    .querySelectorAll("source")
    .forEach(source => source.removeAttribute("src"));
  if (player) node.load();
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp"
]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/flac",
  "audio/x-flac"
]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime"
]);

// The server decides from its storage metadata. A legacy image prefix or a
// display filename cannot opt active/unknown bytes into a native preview.
export function chatMediaPreview(headers) {
  const disposition = String(headers?.["content-disposition"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (disposition !== "inline") return null;
  const mimeType = String(headers?.["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const kind = IMAGE_TYPES.has(mimeType)
    ? "image"
    : AUDIO_TYPES.has(mimeType)
      ? "audio"
      : VIDEO_TYPES.has(mimeType)
        ? "video"
        : null;
  return kind ? { kind, mimeType } : null;
}
