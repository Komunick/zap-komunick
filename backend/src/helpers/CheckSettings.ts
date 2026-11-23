import Setting from "../models/Setting";
import AppError from "../errors/AppError";
import { SimpleObjectCache } from "./simpleObjectCache";
import { logger } from "../utils/logger";

const settingCache = new SimpleObjectCache<string>(10000, logger);

export const invalidateCompanySettingCache = (
  companyId: number,
  key: string
): void => {
  settingCache.delete(`${companyId}-${key}`);
};

export const invalidateCompanySettingCacheByPrefix = (
  companyId: number,
  keyPrefix: string
): void => {
  settingCache.deleteByPrefix(`${companyId}-${keyPrefix}`);
};

const CheckSettings = async (
  key: string,
  defaultValue: string = null
): Promise<string> => {
  // Zap Komunick: no cache and the same semantics as before the Ticketz
  // update (an empty value falls back to the default here only)
  const setting = await Setting.findOne({
    where: {
      companyId: 1,
      key
    }
  });

  if (!setting && defaultValue === null) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  return setting?.value || defaultValue;
};

/**
 * Get the company setting by key
 *
 * @param companyId - The ID of the company
 * @param key - The key of the setting
 * @param defaultValue - The default value to return if the setting is not found
 * @return The value of the setting or the default value
 */
export const GetCompanySetting = async (
  companyId: number,
  key: string,
  defaultValue: string = undefined,
  // Zap Komunick: opt-in. Many services write Settings directly (IP
  // allowlist, credentials, companies) without invalidating this cache.
  useCache = false
): Promise<string> => {
  if (useCache) {
    const cachedValue = settingCache.get<string>(`${companyId}-${key}`);
    if (cachedValue !== null) {
      return cachedValue;
    }
  }

  const setting = await Setting.findOne({
    where: {
      companyId,
      key
    }
  });

  if (!setting && defaultValue === undefined) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  // Zap Komunick: keep a stored empty value, as before the Ticketz update
  const settingValue = setting ? setting.value : defaultValue;

  if (useCache) {
    settingCache.set(`${companyId}-${key}`, settingValue ?? null);
  }

  return settingValue;
};

export default CheckSettings;
