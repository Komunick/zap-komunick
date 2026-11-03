// Zap Komunick: chat scope is always the authenticated company and member.
export interface ChatActor {
  userId: string | number;
  companyId: number;
}

export function positiveChatId(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function chatAccessError(
  chat: { companyId: number; ownerId: number; isDirect: boolean },
  actor: { userId: number; companyId: number },
  memberIds: number[],
  manage = false
): string | undefined {
  if (chat.companyId !== actor.companyId || !memberIds.includes(actor.userId)) {
    return "ERR_NO_CHAT_FOUND";
  }
  if (manage && chat.isDirect) return "ERR_CHAT_DIRECT_READONLY";
  if (manage && chat.ownerId !== actor.userId) return "ERR_NO_PERMISSION";
  return undefined;
}

export function chatParticipantIds(
  value: unknown,
  ownerId: number
): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.map(item =>
    item && typeof item === "object"
      ? positiveChatId((item as { id?: unknown }).id)
      : undefined
  );
  if (ids.some(id => id === undefined)) return undefined;
  return [...new Set([ownerId, ...(ids as number[])])];
}

export function validChatTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
