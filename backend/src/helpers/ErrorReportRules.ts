import AppError from "../errors/AppError";

// Zap Komunick: limits of the error report (docs/PRD.md, RF-030). The total
// stays under the 25 MB most mail servers accept once the files are encoded
// as base64 (about a third larger).
export const ERROR_REPORT_MAX_FILES = 5;
export const ERROR_REPORT_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const ERROR_REPORT_MAX_PER_HOUR = 10;
export const ERROR_REPORT_TITLE_MAX = 150;
export const ERROR_REPORT_LOCATION_MAX = 200;
export const ERROR_REPORT_DESCRIPTION_MAX = 5000;

export interface ErrorReportFileType {
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
export const errorReportFileType = (
  bytes: Buffer
): ErrorReportFileType | null => {
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

const invalid = () => new AppError("ERR_ERROR_REPORT_INVALID", 400);

/**
 * Text field of the report: a string within the limit, without control
 * characters other than line breaks and tabs.
 */
export const errorReportText = (
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

/** Single-line version of a text, for the subject and the table of the mail. */
export const singleLine = (text: string): string =>
  text.replace(/\s+/g, " ").trim();
