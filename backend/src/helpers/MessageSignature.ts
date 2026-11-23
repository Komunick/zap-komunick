import AppError from "../errors/AppError";
import Setting from "../models/Setting";
import type User from "../models/User";

export const FORCE_MESSAGE_SIGNATURE = "forceMessageSignature";

export async function isMessageSignatureRequired(companyId: number) {
  const enabled = await Setting.count({
    where: { companyId, key: FORCE_MESSAGE_SIGNATURE, value: "enabled" }
  });
  return enabled > 0;
}

export function formatSignedMessage(
  body: string,
  companyId: number,
  actor: Pick<User, "companyId" | "name"> | null,
  render: (text: string) => string
): string {
  if (actor?.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const name = actor.name.replace(/[\r\n]+/g, " ").trim();
  if (!name || typeof body !== "string" || !body.trim()) {
    throw new AppError("ERR_SYNTAX", 400);
  }

  const prefix = `*${name}:*`;
  const lineBreakIndex = body.indexOf("\n");
  const hasSignature =
    lineBreakIndex >= 0 &&
    body.slice(0, lineBreakIndex).replace(/\r$/, "") === prefix;
  // Keep the account name literal and render template fields only in the text.
  const content = render(hasSignature ? body.slice(lineBreakIndex + 1) : body);
  return `${prefix}\n${content}`;
}
