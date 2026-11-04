import AppError from "../errors/AppError";
import { localAttachmentPath, safeAttachmentName } from "./AttachmentRules";

export function queueEntityId(value: unknown): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^[1-9]\d*$/.test(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) <= 0
  )
    throw new AppError("ERR_BAD_REQUEST", 400);
  return Number(value);
}

export function queueOptionFields(value: Record<string, unknown>) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("ERR_BAD_REQUEST", 400);
  const fields: Record<string, unknown> = {};
  ["title", "message", "option", "exitChatbot"].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(value, key))
      fields[key] = value[key];
  });
  ["queueId", "parentId", "forwardQueueId"].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(value, key))
      fields[key] =
        value[key] === null || value[key] === ""
          ? null
          : queueEntityId(value[key]);
  });
  return fields;
}

export function queueMediaPath(value: unknown, companyId: number): string {
  if (typeof value !== "string" || /[:]/.test(value))
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  try {
    return localAttachmentPath(value, companyId);
  } catch {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }
}

export function queueMediaName(value: unknown): string {
  const name = safeAttachmentName(value).replace(/[<>:"|?*]/g, "_");
  if (name === "." || name === "..") throw new AppError("ERR_BAD_REQUEST", 400);
  return name;
}
