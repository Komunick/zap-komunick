import { Op, Transaction, literal } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyCredential from "../../models/CompanyCredential";
import Setting from "../../models/Setting";
import {
  CREDENTIAL_KEYS,
  CredentialKey,
  legacyCredentialValue,
  requireCredentialKey,
  requireCredentialValue
} from "../../helpers/CredentialRules";
import {
  currentMasterKeyId,
  decryptCredential,
  encryptCredential,
  requireMasterKey
} from "../../helpers/CredentialCipher";

export interface CredentialStatus {
  key: CredentialKey;
  configured: boolean;
  source: "encrypted" | "legacy" | "none";
  migrationPending: boolean;
  masterKeyConfigured: boolean;
}

const protectStorage = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    // ORM errors can embed SQL, bound parameters and loaded plaintext.
    throw new AppError("ERR_CREDENTIAL_STORAGE_UNAVAILABLE", 503);
  }
};

// Serialize all writes for a company, including the first insert of a key.
const lockCompany = async (companyId: number, transaction: Transaction) => {
  const company = await Company.findByPk(companyId, {
    attributes: ["id"],
    transaction,
    lock: transaction.LOCK.UPDATE,
    logging: false
  });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);
};

export const listCredentialStatus = async (
  companyId: number
): Promise<CredentialStatus[]> =>
  protectStorage(async () => {
    const credentials = await CompanyCredential.findAll({
      where: { companyId, key: { [Op.in]: CREDENTIAL_KEYS } },
      attributes: ["key", "keyId"],
      logging: false
    });
    // Status queries never load legacy plaintext into the response process.
    const legacy = await Setting.findAll({
      where: { companyId, key: { [Op.in]: CREDENTIAL_KEYS } },
      attributes: [
        "key",
        [literal("length(COALESCE(\"value\", '')) > 0"), "configured"]
      ],
      raw: true,
      logging: false
    });
    const masterId = currentMasterKeyId();
    return CREDENTIAL_KEYS.map(key => {
      const encrypted = credentials.find(row => row.key === key);
      const pending = legacy.some(
        row =>
          row.key === key &&
          !!(row as unknown as { configured: boolean }).configured
      );
      return {
        key,
        configured: !!encrypted || pending,
        source: encrypted ? "encrypted" : pending ? "legacy" : "none",
        migrationPending:
          pending || !!(encrypted && encrypted.keyId !== masterId),
        masterKeyConfigured: !!masterId
      };
    });
  });

export const credentialStatus = async (
  companyId: number,
  key: string
): Promise<CredentialStatus> =>
  protectStorage(async () => {
    const validKey = requireCredentialKey(key);
    return (await listCredentialStatus(companyId)).find(
      row => row.key === validKey
    );
  });

export const saveCredential = async (
  companyId: number,
  key: string,
  value: unknown
): Promise<CredentialStatus> =>
  protectStorage(async () => {
    const validKey = requireCredentialKey(key);
    const encrypted = encryptCredential(
      companyId,
      validKey,
      requireCredentialValue(value)
    );
    await sequelize.transaction(async transaction => {
      await lockCompany(companyId, transaction);
      const [credential] = await CompanyCredential.unscoped().findOrCreate({
        where: { companyId, key: validKey },
        defaults: { companyId, key: validKey, ...encrypted },
        transaction,
        logging: false
      });
      await credential.update(encrypted, { transaction, logging: false });
      await Setting.destroy({
        where: { companyId, key: validKey },
        transaction,
        logging: false
      });
    });
    return credentialStatus(companyId, validKey);
  });

export const deleteCredential = async (
  companyId: number,
  key: string
): Promise<CredentialStatus> =>
  protectStorage(async () => {
    const validKey = requireCredentialKey(key);
    await sequelize.transaction(async transaction => {
      await lockCompany(companyId, transaction);
      await CompanyCredential.destroy({
        where: { companyId, key: validKey },
        transaction,
        logging: false
      });
      await Setting.destroy({
        where: { companyId, key: validKey },
        transaction,
        logging: false
      });
    });
    return credentialStatus(companyId, validKey);
  });

export const migrateCredentials = async (
  companyId: number
): Promise<CredentialStatus[]> =>
  protectStorage(async () => {
    requireMasterKey();
    await sequelize.transaction(async transaction => {
      await lockCompany(companyId, transaction);
      const where = { companyId, key: { [Op.in]: CREDENTIAL_KEYS } };
      const credentials = await CompanyCredential.unscoped().findAll({
        where,
        transaction,
        logging: false
      });
      const legacy = await Setting.findAll({
        where,
        transaction,
        logging: false
      });
      // Prepare and verify every existing cipher before deleting any legacy value.
      const prepared = CREDENTIAL_KEYS.map(key => {
        const existing = credentials.find(row => row.key === key);
        const oldValue = legacyCredentialValue(legacy, key);
        const value = existing
          ? decryptCredential(companyId, key, existing.encryptedValue)
          : oldValue;
        if (existing && oldValue && value !== oldValue) {
          throw new AppError("ERR_CREDENTIAL_MIGRATION_CONFLICT", 409);
        }
        return {
          key,
          existing,
          encrypted: value ? encryptCredential(companyId, key, value) : null
        };
      });
      for (let index = 0; index < prepared.length; index += 1) {
        const entry = prepared[index];
        if (entry.encrypted) {
          if (entry.existing) {
            await entry.existing.update(entry.encrypted, {
              transaction,
              logging: false
            });
          } else {
            await CompanyCredential.create(
              { companyId, key: entry.key, ...entry.encrypted },
              { transaction, logging: false }
            );
          }
        }
      }
      await Setting.destroy({ where, transaction, logging: false });
    });
    return listCredentialStatus(companyId);
  });

// Backend-only. Legacy fallback preserves optional transcription until explicit migration.
export const resolveCredential = async (
  companyId: number,
  key: CredentialKey
): Promise<string | null> =>
  protectStorage(async () => {
    requireCredentialKey(key);
    const credential = await CompanyCredential.unscoped().findOne({
      where: { companyId, key },
      logging: false
    });
    if (credential)
      return decryptCredential(companyId, key, credential.encryptedValue);
    const legacy = await Setting.findOne({
      where: { companyId, key },
      logging: false
    });
    return legacy?.value || null;
  });
