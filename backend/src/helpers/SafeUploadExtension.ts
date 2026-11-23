import path from "path";

// Zap Komunick: the client controls originalname. Stored names keep only a
// plain alphanumeric extension, so quotes, spaces and shell metacharacters
// never reach the disk name or any later command line.
const SAFE_EXTENSION = /^\.[a-zA-Z0-9]{1,32}$/;

export function safeUploadExtension(originalName: unknown): string {
  if (typeof originalName !== "string") return "";
  const extension = path.extname(originalName);
  return SAFE_EXTENSION.test(extension) ? extension : "";
}
