import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Zap Komunick: two-factor codes (docs/PRD.md, RF-016). TOTP of RFC 6238
// (HMAC-SHA1, 30 s, 6 digits), the same that Google Authenticator, Microsoft
// Authenticator, Authy and 1Password read from the QR code. No dependency.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  buffer.forEach(byte => {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  clean.split("").forEach(char => {
    const index = ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error("ERR_INVALID_BASE32");
    }
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  });
  return Buffer.from(bytes);
}

/** HOTP of RFC 4226 for one counter. */
export function hotp(key: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", new Uint8Array(key))
    .update(new Uint8Array(message))
    .digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary =
    ((hmac[offset] & 127) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const TOTP_STEP_SECONDS = 30;

export function totp(
  secret: string,
  time: number = Date.now(),
  digits = 6
): string {
  return hotp(
    base32Decode(secret),
    Math.floor(time / 1000 / TOTP_STEP_SECONDS),
    digits
  );
}

/**
 * Accepts the current code and the ones of the step before and after (a
 * clock up to 30 s off), comparing in constant time.
 */
export function verifyTotp(
  secret: string,
  code: unknown,
  time: number = Date.now(),
  window = 1
): boolean {
  return matchingTotpCounter(secret, code, time, window) !== null;
}

export function matchingTotpCounter(
  secret: string,
  code: unknown,
  time: number = Date.now(),
  window = 1
): number | null {
  const clean = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) {
    return null;
  }
  const counter = Math.floor(time / 1000 / TOTP_STEP_SECONDS);
  const key = base32Decode(secret);
  let match: number | null = null;
  for (let delta = -window; delta <= window; delta += 1) {
    if (counter + delta < 0) continue;
    const expected = new Uint8Array(Buffer.from(hotp(key, counter + delta)));
    if (timingSafeEqual(expected, new Uint8Array(Buffer.from(clean)))) {
      match = counter + delta;
    }
  }
  return match;
}

/** 160-bit secret, as the RFC recommends for HMAC-SHA1. */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

export function otpauthUri(
  secret: string,
  account: string,
  issuer: string
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/** Recovery codes like "7K3Q-9MZD", without letters that look alike. */
export function generateRecoveryCodes(count = 8): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const text = Array.from(bytes, b => chars[b % chars.length]).join("");
    return `${text.slice(0, 4)}-${text.slice(4)}`;
  });
}

export const normalizeRecoveryCode = (code: unknown): string =>
  String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^(.{4})(.{4})$/, "$1-$2");
