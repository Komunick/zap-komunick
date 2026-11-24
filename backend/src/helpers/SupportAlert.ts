import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Zap Komunick: key of the support alert (docs/PRD.md, RF-030). A small
// program on the computer of who answers the tickets asks, with this key, what
// is waiting in the queue. The key is not a login: it opens that one read-only
// route. Only its SHA-256 is stored, so the database never holds the key.
export const SUPPORT_ALERT_SETTING = "_supportAlertTokenHash";
const PREFIX = "sca_";
const TOKEN = /^sca_[A-Za-z0-9_-]{43}$/;

export const supportAlertTokenHash = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const newSupportAlertToken = (): { token: string; hash: string } => {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: supportAlertTokenHash(token) };
};

/** The key of a request: "Authorization: Bearer sca_…". Anything else is null. */
export const supportAlertTokenOf = (authorization: unknown): string | null => {
  if (typeof authorization !== "string") return null;
  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  if (
    rest.length ||
    !/^bearer$/i.test(scheme || "") ||
    !TOKEN.test(token || "")
  )
    return null;
  return token;
};

/** Compares the key with the stored hash without leaking where they differ. */
export const supportAlertTokenMatches = (
  token: string | null,
  storedHash: string | null | undefined
): boolean => {
  if (!token || !storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
  return timingSafeEqual(
    bytes(supportAlertTokenHash(token)),
    bytes(storedHash)
  );
};
