import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "crypto";
import AppError from "../errors/AppError";
import { CredentialKey } from "./CredentialRules";

interface Envelope {
  version: 1;
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const masterKey = (name: string): Buffer | null => {
  const value = process.env[name];
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const key = Buffer.from(value, "base64");
  return key.length === 32 && key.toString("base64") === value ? key : null;
};

const keyId = (key: Buffer): string =>
  createHash("sha256").update(Uint8Array.from(key)).digest("hex").slice(0, 16);

export const currentMasterKeyId = (): string | null => {
  const key = masterKey("CREDENTIALS_MASTER_KEY");
  return key ? keyId(key) : null;
};

export const requireMasterKey = (): Buffer => {
  const key = masterKey("CREDENTIALS_MASTER_KEY");
  if (!key) throw new AppError("ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE", 503);
  return key;
};

const aad = (companyId: number, key: CredentialKey, id: string): Uint8Array =>
  Uint8Array.from(
    Buffer.from(JSON.stringify(["company-credential", 1, companyId, key, id]))
  );

export const encryptCredential = (
  companyId: number,
  key: CredentialKey,
  value: string
): { encryptedValue: string; keyId: string } => {
  const master = requireMasterKey();
  const id = keyId(master);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Uint8Array.from(master),
    Uint8Array.from(iv)
  );
  cipher.setAAD(aad(companyId, key, id));
  const encrypted = Buffer.concat([
    Uint8Array.from(cipher.update(value, "utf8")),
    Uint8Array.from(cipher.final())
  ]);
  const envelope: Envelope = {
    version: 1,
    keyId: id,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64")
  };
  return { encryptedValue: JSON.stringify(envelope), keyId: id };
};

export const decryptCredential = (
  companyId: number,
  key: CredentialKey,
  encryptedValue: string
): string => {
  const current = requireMasterKey();
  try {
    const envelope = JSON.parse(encryptedValue) as Envelope;
    const previous = masterKey("CREDENTIALS_PREVIOUS_MASTER_KEY");
    const master = [current, previous].find(
      candidate => candidate && keyId(candidate) === envelope.keyId
    );
    if (!master || envelope.version !== 1) throw new Error("invalid envelope");
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    if (iv.length !== 12 || tag.length !== 16)
      throw new Error("invalid envelope");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Uint8Array.from(master),
      Uint8Array.from(iv)
    );
    decipher.setAAD(aad(companyId, key, envelope.keyId));
    decipher.setAuthTag(Uint8Array.from(tag));
    return Buffer.concat([
      Uint8Array.from(
        decipher.update(
          Uint8Array.from(Buffer.from(envelope.ciphertext, "base64"))
        )
      ),
      Uint8Array.from(decipher.final())
    ]).toString("utf8");
  } catch {
    throw new AppError("ERR_CREDENTIAL_DECRYPTION_FAILED", 503);
  }
};
