// Zap Komunick: recipients and attachment of scheduled messages
// (docs/PRD.md, RF-008)

// one schedule per contact; keeps a single request bounded
export const MAX_SCHEDULE_RECIPIENTS = 500;

/**
 * Attachments are stored once per company under media-persistant/<companyId>/
 * by the upload route; a schedule may only point to a file of its company.
 */
export function isValidScheduleMediaPath(
  mediaPath: unknown,
  companyId: number
): boolean {
  if (typeof mediaPath !== "string") {
    return false;
  }
  const pattern = new RegExp(
    `^media-persistant/${companyId}/[A-Za-z0-9]+/[^/\\\\]+$`
  );
  return pattern.test(mediaPath) && !mediaPath.includes("..");
}

/**
 * Unique recipients from the chosen contacts and the contacts of the chosen
 * tag. Throws when nothing or too many were chosen.
 */
export function mergeRecipients(
  contactIds: unknown[],
  tagContactIds: number[]
): number[] {
  const ids = [
    ...contactIds
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0),
    ...tagContactIds
  ];
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new Error("ERR_SCHEDULE_NO_RECIPIENTS");
  }
  if (unique.length > MAX_SCHEDULE_RECIPIENTS) {
    throw new Error("ERR_SCHEDULE_TOO_MANY_RECIPIENTS");
  }
  return unique;
}
