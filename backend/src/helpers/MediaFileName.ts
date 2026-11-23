import path from "path";
import mime from "mime-types";

// Zap Komunick: Messages.mediaUrl is VARCHAR(255) and most filesystems cap a
// name at 255 bytes. The WhatsApp side keeps the sender's full file name; only
// the copy written to disk is shortened, so a long PDF name no longer fails
// after the message has already left.
export const MAX_MEDIA_URL_LENGTH = 255;
export const MAX_MEDIA_NAME_BYTES = 200;

const UNSAFE = /[\p{Cc}‪-‮⁦-⁩/\\:*?"<>|%#]/gu;
const PLAIN_EXTENSION = /^\.[A-Za-z0-9]{1,16}$/;

const fallbackExtension = (mimetype: string): string => {
  const extension = mime.extension((mimetype || "").split(";")[0].trim());
  return extension ? `.${extension}` : ".bin";
};

export function storedMediaFileName(
  originalName: unknown,
  mimetype: string,
  prefixLength = 0
): string {
  const cleaned = (typeof originalName === "string" ? originalName : "")
    .normalize("NFC")
    .replace(UNSAFE, "_")
    .replace(/\s+/g, " ")
    .trim();
  const rawExtension = path.extname(cleaned);
  const extension = PLAIN_EXTENSION.test(rawExtension)
    ? rawExtension
    : fallbackExtension(mimetype);
  let base = (
    PLAIN_EXTENSION.test(rawExtension)
      ? cleaned.slice(0, -rawExtension.length)
      : cleaned
  )
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();

  const characterBudget = Math.max(
    1,
    MAX_MEDIA_URL_LENGTH - prefixLength - extension.length
  );
  const fits = (candidate: string) =>
    candidate.length <= characterBudget &&
    Buffer.byteLength(candidate + extension, "utf8") <= MAX_MEDIA_NAME_BYTES;
  if (!fits(base)) {
    const characters = Array.from(base);
    while (characters.length && !fits(characters.join(""))) characters.pop();
    base = characters.join("").replace(/[.\s]+$/g, "");
  }
  if (!base) base = String(Date.now());
  return `${base}${extension}`;
}
