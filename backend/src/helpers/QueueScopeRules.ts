export type QueueListScope =
  | { companyId: number }
  | { error: "ERR_BAD_REQUEST" | "ERR_NO_PERMISSION"; statusCode: 400 | 403 };

// Zap Komunick: only a verified superuser can choose another company's queues.
export function queueListScope(
  companyId: number,
  isSuper: boolean,
  requestedCompanyId: unknown
): QueueListScope {
  if (requestedCompanyId === undefined) return { companyId };
  if (
    typeof requestedCompanyId !== "string" ||
    !/^[1-9]\d*$/.test(requestedCompanyId) ||
    !Number.isSafeInteger(Number(requestedCompanyId))
  ) {
    return { error: "ERR_BAD_REQUEST", statusCode: 400 };
  }

  const requested = Number(requestedCompanyId);
  if (requested !== companyId && !isSuper) {
    return { error: "ERR_NO_PERMISSION", statusCode: 403 };
  }
  return { companyId: requested };
}
