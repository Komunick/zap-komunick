import { randomBytes } from "crypto";
import sequelize from "../../database";
import Company from "../../models/Company";
import CompanyCredential from "../../models/CompanyCredential";
import Setting from "../../models/Setting";
import {
  deleteCredential,
  listCredentialStatus,
  migrateCredentials,
  resolveCredential,
  saveCredential
} from "../../services/CredentialServices/CredentialService";
import {
  decryptCredential,
  encryptCredential
} from "../../helpers/CredentialCipher";

jest.mock("../../database", () => ({ transaction: jest.fn() }));
jest.mock("../../models/Company", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/CompanyCredential", () => {
  const model = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    unscoped: jest.fn()
  };
  model.unscoped.mockReturnValue(model);
  return model;
});
jest.mock("../../models/Setting", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  destroy: jest.fn()
}));

const value = "fixture-vault-value-not-real";
const originalMaster = process.env.CREDENTIALS_MASTER_KEY;
const originalPrevious = process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
const transaction = { LOCK: { UPDATE: "UPDATE" } };

describe("credential storage boundaries and recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
    (sequelize.transaction as jest.Mock).mockImplementation(operation =>
      operation(transaction)
    );
    (Company.findByPk as jest.Mock).mockResolvedValue({ id: 7 });
    (CompanyCredential.findAll as jest.Mock).mockResolvedValue([]);
    (CompanyCredential.findOne as jest.Mock).mockResolvedValue(null);
    (Setting.findAll as jest.Mock).mockResolvedValue([]);
    (Setting.findOne as jest.Mock).mockResolvedValue(null);
    (CompanyCredential.findOrCreate as jest.Mock).mockResolvedValue([
      { update: jest.fn() },
      true
    ]);
  });
  afterAll(() => {
    if (originalMaster === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = originalMaster;
    if (originalPrevious === undefined)
      delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
    else process.env.CREDENTIALS_PREVIOUS_MASTER_KEY = originalPrevious;
  });

  it("reports legacy pending without querying its plaintext", async () => {
    (Setting.findAll as jest.Mock).mockResolvedValue([
      { key: "openAiKey", configured: true }
    ]);
    delete process.env.CREDENTIALS_MASTER_KEY;
    const result = await listCredentialStatus(7);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      key: "openAiKey",
      configured: true,
      source: "legacy",
      migrationPending: true,
      masterKeyConfigured: false
    });
    expect(Setting.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 7 }),
        raw: true,
        attributes: ["key", expect.any(Array)],
        logging: false
      })
    );
    expect(JSON.stringify(result)).not.toContain(value);
  });

  it("preserves legacy on absent master before starting any write transaction", async () => {
    delete process.env.CREDENTIALS_MASTER_KEY;
    await expect(migrateCredentials(7)).rejects.toMatchObject({
      message: "ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE",
      statusCode: 503
    });
    await expect(saveCredential(7, "openAiKey", value)).rejects.toMatchObject({
      message: "ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE"
    });
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(Setting.destroy).not.toHaveBeenCalled();
  });

  it("migrates privately in a company transaction and only stores ciphertext", async () => {
    (Setting.findAll as jest.Mock).mockImplementation(options =>
      options.raw ? [] : [{ key: "openAiKey", value }]
    );
    await migrateCredentials(7);
    const [created, options] = (CompanyCredential.create as jest.Mock).mock
      .calls[0];
    expect(created).toEqual(
      expect.objectContaining({ companyId: 7, key: "openAiKey" })
    );
    expect(JSON.stringify(created)).not.toContain(value);
    expect(decryptCredential(7, "openAiKey", created.encryptedValue)).toBe(
      value
    );
    expect(options).toEqual({ transaction, logging: false });
    expect(Company.findByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ transaction, lock: "UPDATE" })
    );
    expect(Setting.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 7 }),
        transaction
      })
    );
  });

  it("rejects a divergent duplicate before any migration write or deletion", async () => {
    const encrypted = encryptCredential(7, "sciClientToken", value);
    const update = jest.fn();
    (CompanyCredential.findAll as jest.Mock).mockResolvedValue([
      { key: "sciClientToken", ...encrypted, update }
    ]);
    (Setting.findAll as jest.Mock).mockResolvedValue([
      { key: "openAiKey", value },
      { key: "sciClientToken", value: "different-fixture-value" }
    ]);
    await expect(migrateCredentials(7)).rejects.toMatchObject({
      message: "ERR_CREDENTIAL_MIGRATION_CONFLICT",
      statusCode: 409
    });
    expect(CompanyCredential.create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(Setting.destroy).not.toHaveBeenCalled();
  });

  it("preserves every row if a later existing credential cannot be decrypted", async () => {
    const encrypted = encryptCredential(7, "sciClientToken", value);
    (CompanyCredential.findAll as jest.Mock).mockResolvedValue([
      { key: "sciClientToken", ...encrypted }
    ]);
    (Setting.findAll as jest.Mock).mockResolvedValue([
      { key: "openAiKey", value }
    ]);
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    await expect(migrateCredentials(7)).rejects.toMatchObject({
      message: "ERR_CREDENTIAL_DECRYPTION_FAILED"
    });
    expect(CompanyCredential.create).not.toHaveBeenCalled();
    expect(Setting.destroy).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "preserves divergent duplicate legacy rows (encrypted existing: %s)",
    async hasEncrypted => {
      const update = jest.fn();
      if (hasEncrypted) {
        (CompanyCredential.findAll as jest.Mock).mockResolvedValue([
          {
            key: "openAiKey",
            ...encryptCredential(7, "openAiKey", value),
            update
          }
        ]);
      }
      (Setting.findAll as jest.Mock).mockResolvedValue([
        { id: 10, key: "openAiKey", value },
        { id: 11, key: "openAiKey", value: "second-different-fixture" }
      ]);
      await expect(migrateCredentials(7)).rejects.toMatchObject({
        message: "ERR_CREDENTIAL_MIGRATION_CONFLICT",
        statusCode: 409
      });
      expect(CompanyCredential.create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(Setting.destroy).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    "migrates identical duplicate legacy rows safely (encrypted existing: %s)",
    async hasEncrypted => {
      const update = jest.fn();
      if (hasEncrypted) {
        (CompanyCredential.findAll as jest.Mock).mockResolvedValue([
          {
            key: "openAiKey",
            ...encryptCredential(7, "openAiKey", value),
            update
          }
        ]);
      }
      (Setting.findAll as jest.Mock).mockResolvedValue([
        { id: 10, key: "openAiKey", value },
        { id: 11, key: "openAiKey", value },
        { id: 12, key: "openAiKey", value: "" }
      ]);
      await migrateCredentials(7);
      const replacement = hasEncrypted
        ? update.mock.calls[0][0]
        : (CompanyCredential.create as jest.Mock).mock.calls[0][0];
      expect(
        decryptCredential(7, "openAiKey", replacement.encryptedValue)
      ).toBe(value);
      expect(Setting.destroy).toHaveBeenCalledTimes(1);
    }
  );

  it("rewraps with the current master and can remove an identical legacy duplicate", async () => {
    const encrypted = encryptCredential(7, "openAiKey", value);
    const update = jest.fn();
    (CompanyCredential.findAll as jest.Mock).mockResolvedValue([
      { key: "openAiKey", ...encrypted, update }
    ]);
    (Setting.findAll as jest.Mock).mockResolvedValue([
      { key: "openAiKey", value }
    ]);
    process.env.CREDENTIALS_PREVIOUS_MASTER_KEY =
      process.env.CREDENTIALS_MASTER_KEY;
    process.env.CREDENTIALS_MASTER_KEY = randomBytes(32).toString("base64");
    await migrateCredentials(7);
    const replacement = update.mock.calls[0][0];
    expect(replacement.keyId).not.toBe(encrypted.keyId);
    delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
    expect(decryptCredential(7, "openAiKey", replacement.encryptedValue)).toBe(
      value
    );
    expect(Setting.destroy).toHaveBeenCalledTimes(1);
  });

  it("rotates values with company scoping and revokes both encrypted and legacy copies without master", async () => {
    const update = jest.fn();
    (CompanyCredential.findOrCreate as jest.Mock).mockResolvedValue([
      { update },
      false
    ]);
    await saveCredential(7, "openAiKey", value);
    expect(CompanyCredential.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 7, key: "openAiKey" },
        transaction
      })
    );
    expect(
      decryptCredential(7, "openAiKey", update.mock.calls[0][0].encryptedValue)
    ).toBe(value);
    delete process.env.CREDENTIALS_MASTER_KEY;
    await deleteCredential(7, "openAiKey");
    expect(CompanyCredential.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 7, key: "openAiKey" },
        transaction
      })
    );
    expect(Setting.destroy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { companyId: 7, key: "openAiKey" },
        transaction
      })
    );
  });

  it("uses scoped private legacy fallback, but never falls back on damaged encrypted state", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value });
    expect(await resolveCredential(7, "openAiKey")).toBe(value);
    expect(Setting.findOne).toHaveBeenCalledWith({
      where: { companyId: 7, key: "openAiKey" },
      logging: false
    });
    (Setting.findOne as jest.Mock).mockClear();
    (CompanyCredential.findOne as jest.Mock).mockResolvedValue({
      encryptedValue: "bad envelope"
    });
    await expect(resolveCredential(7, "openAiKey")).rejects.toMatchObject({
      message: "ERR_CREDENTIAL_DECRYPTION_FAILED"
    });
    expect(Setting.findOne).not.toHaveBeenCalled();
  });

  it("normalizes database failures so global handlers cannot serialize secrets", async () => {
    (CompanyCredential.findAll as jest.Mock).mockRejectedValue({
      message: value,
      sql: value,
      parameters: [value]
    });
    const error = await listCredentialStatus(7).catch(failure => failure);
    expect(error).toMatchObject({
      message: "ERR_CREDENTIAL_STORAGE_UNAVAILABLE",
      statusCode: 503
    });
    expect(JSON.stringify(error)).not.toContain(value);
  });
});
