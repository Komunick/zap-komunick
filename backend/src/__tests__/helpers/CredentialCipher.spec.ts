import { randomBytes } from "crypto";
import {
  currentMasterKeyId,
  decryptCredential,
  encryptCredential
} from "../../helpers/CredentialCipher";
import {
  CREDENTIAL_KEYS,
  publicCompanyData,
  requireCredentialKey,
  requireCredentialValue
} from "../../helpers/CredentialRules";

const value = "test-credential-value-not-a-real-key";
const originalMaster = process.env.CREDENTIALS_MASTER_KEY;
const originalPrevious = process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;

describe("company credentials", () => {
  beforeEach(() => {
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
  });
  afterAll(() => {
    if (originalMaster === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = originalMaster;
    if (originalPrevious === undefined)
      delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
    else process.env.CREDENTIALS_PREVIOUS_MASTER_KEY = originalPrevious;
  });

  it.each(CREDENTIAL_KEYS)("encrypts and privately resolves %s", key => {
    const first = encryptCredential(7, key, value);
    const second = encryptCredential(7, key, value);
    expect(first.encryptedValue).not.toContain(value);
    expect(second.encryptedValue).not.toBe(first.encryptedValue);
    expect(decryptCredential(7, key, first.encryptedValue)).toBe(value);
    expect(decryptCredential(7, key, second.encryptedValue)).toBe(value);
  });

  it("rejects ciphertext copied to another company or credential key", () => {
    const envelope = encryptCredential(7, "openAiKey", value).encryptedValue;
    expect(() => decryptCredential(8, "openAiKey", envelope)).toThrow(
      "ERR_CREDENTIAL_DECRYPTION_FAILED"
    );
    expect(() => decryptCredential(7, "sciClientToken", envelope)).toThrow(
      "ERR_CREDENTIAL_DECRYPTION_FAILED"
    );
  });

  it("rejects tampered ciphertext and a wrong master without disclosing the input", () => {
    const encrypted = encryptCredential(7, "openAiKey", value);
    const tampered = JSON.parse(encrypted.encryptedValue);
    tampered.ciphertext = Buffer.from("tampered ciphertext").toString("base64");
    expect(() =>
      decryptCredential(7, "openAiKey", JSON.stringify(tampered))
    ).toThrow("ERR_CREDENTIAL_DECRYPTION_FAILED");
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    expect(() =>
      decryptCredential(7, "openAiKey", encrypted.encryptedValue)
    ).toThrow("ERR_CREDENTIAL_DECRYPTION_FAILED");
  });

  it.each([undefined, "", "invalid", Buffer.alloc(16).toString("base64")])(
    "refuses missing or malformed master %s",
    invalid => {
      if (invalid === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
      else process.env.CREDENTIALS_MASTER_KEY = invalid;
      expect(currentMasterKeyId()).toBeNull();
      expect(() => encryptCredential(7, "openAiKey", value)).toThrow(
        "ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE"
      );
    }
  );

  it("reads an explicitly supplied previous master for safe rewrapping", () => {
    const encrypted = encryptCredential(7, "openAiKey", value);
    process.env.CREDENTIALS_PREVIOUS_MASTER_KEY =
      process.env.CREDENTIALS_MASTER_KEY;
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    expect(decryptCredential(7, "openAiKey", encrypted.encryptedValue)).toBe(
      value
    );
    const rewrapped = encryptCredential(7, "openAiKey", value);
    expect(rewrapped.keyId).not.toBe(encrypted.keyId);
    delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
    expect(decryptCredential(7, "openAiKey", rewrapped.encryptedValue)).toBe(
      value
    );
    expect(() =>
      decryptCredential(7, "openAiKey", encrypted.encryptedValue)
    ).toThrow("ERR_CREDENTIAL_DECRYPTION_FAILED");
  });

  it.each([null, {}, "", " ", "x".repeat(16385)])(
    "rejects invalid values",
    input => {
      expect(() => requireCredentialValue(input)).toThrow(
        "ERR_INVALID_CREDENTIAL_VALUE"
      );
    }
  );

  it("requires an approved key and preserves valid value bytes", () => {
    expect(() => requireCredentialKey("otherToken")).toThrow(
      "ERR_INVALID_CREDENTIAL_KEY"
    );
    expect(requireCredentialValue(" value ")).toBe(" value ");
  });

  it("omits all known general-company secrets and underscore private settings", () => {
    const keys = [
      ...CREDENTIAL_KEYS,
      "apiToken",
      "tokenixc",
      "clientsecretmkauth",
      "_efiClientSecret",
      "_owenToken",
      "_owenSecretKey",
      "_private"
    ];
    const original = {
      settings: [
        ...keys.map(key => ({ key, value })),
        { key: "campaignsEnabled", value: "enabled" }
      ]
    };
    expect(publicCompanyData(original).settings).toEqual([
      { key: "campaignsEnabled", value: "enabled" }
    ]);
    expect(original.settings).toHaveLength(keys.length + 1);
  });
});
