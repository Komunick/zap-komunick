import AppError from "../errors/AppError";

// Zap Komunick: these credentials are managed exclusively by the backend vault.
export const CREDENTIAL_KEYS = [
  "openAiKey",
  "acessoriasApiToken",
  "sciPartnerToken",
  "sciClientToken"
] as const;

export type CredentialKey = (typeof CREDENTIAL_KEYS)[number];

export const isCredentialKey = (key: string): key is CredentialKey =>
  (CREDENTIAL_KEYS as readonly string[]).includes(key);

export const requireCredentialKey = (key: string): CredentialKey => {
  if (!isCredentialKey(key)) {
    throw new AppError("ERR_INVALID_CREDENTIAL_KEY", 400);
  }
  return key;
};

export const requireCredentialValue = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    Buffer.byteLength(value, "utf8") > 16384
  ) {
    throw new AppError("ERR_INVALID_CREDENTIAL_VALUE", 400);
  }
  return value;
};

// Settings historically allows duplicate keys. Never discard a distinct value.
export const legacyCredentialValue = (
  rows: { key: string; value: string }[],
  key: CredentialKey
): string | undefined => {
  const values = new Set(
    rows.filter(row => row.key === key && row.value).map(row => row.value)
  );
  if (values.size > 1) {
    throw new AppError("ERR_CREDENTIAL_MIGRATION_CONFLICT", 409);
  }
  return Array.from(values)[0];
};

const privateCompanySettings = new Set([
  ...CREDENTIAL_KEYS,
  "apiToken",
  "tokenixc",
  "clientsecretmkauth"
]);

export const publicCompanyData = <T>(company: T): T => {
  if (!company || typeof company !== "object") return company;
  const model = company as T & { get?: (options: object) => T };
  const data = {
    ...(model.get ? model.get({ plain: true }) : company)
  } as T & {
    settings?: { key: string }[];
  };
  if (Array.isArray(data.settings)) {
    data.settings = data.settings.filter(
      setting =>
        !privateCompanySettings.has(setting.key) && !setting.key.startsWith("_")
    );
  }
  return data;
};

export const publicSettingData = <T extends { key: string; value: string }>(
  setting: T
): T => {
  const model = setting as T & { get?: (options: object) => T };
  const data = model.get ? model.get({ plain: true }) : { ...setting };
  return isCredentialKey(data.key)
    ? { ...data, value: "", configured: !!data.value }
    : data;
};
