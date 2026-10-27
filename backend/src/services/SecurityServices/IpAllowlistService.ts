import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Company from "../../models/Company";
import {
  AllowlistSetting,
  MAX_ALLOWLIST_ENTRIES,
  canSignInFrom,
  parseAllowlist
} from "../../helpers/IpAllowlist";

// Zap Komunick: company IP allowlist (docs/PRD.md, RF-016), kept in the
// settings "ipAllowlistEnabled" and "ipAllowlist". They are only written here,
// never through the generic settings route, so the lockout check always runs.

export const IP_ALLOWLIST_KEYS = ["ipAllowlistEnabled", "ipAllowlist"];

export const getAllowlist = async (
  companyId: number
): Promise<AllowlistSetting & { text: string }> => {
  const settings = await Setting.findAll({
    where: { companyId, key: IP_ALLOWLIST_KEYS }
  });
  const enabled =
    settings.find(setting => setting.key === "ipAllowlistEnabled")?.value ===
    "enabled";
  const text =
    settings.find(setting => setting.key === "ipAllowlist")?.value || "";
  return { enabled, text, entries: parseAllowlist(text).entries };
};

export const checkSignInIp = async (
  companyId: number,
  ip: string,
  user: { super?: boolean }
): Promise<boolean> => canSignInFrom(ip, await getAllowlist(companyId), user);

export const saveAllowlist = async ({
  companyId,
  enabled,
  text,
  currentIp,
  isSuper
}: {
  companyId: number;
  enabled: boolean;
  text: string;
  currentIp: string;
  isSuper: boolean;
}): Promise<AllowlistSetting & { text: string }> => {
  const { entries, invalid } = parseAllowlist(text);
  if (invalid.length) {
    throw new AppError("ERR_IP_ALLOWLIST_INVALID", 400);
  }
  if (entries.length > MAX_ALLOWLIST_ENTRIES) {
    throw new AppError("ERR_IP_ALLOWLIST_TOO_MANY", 400);
  }
  if (enabled && entries.length === 0) {
    throw new AppError("ERR_IP_ALLOWLIST_EMPTY", 400);
  }
  // the administrator saving it must still be able to get in
  if (
    enabled &&
    !canSignInFrom(currentIp, { enabled, entries }, { super: isSuper })
  ) {
    throw new AppError("ERR_IP_ALLOWLIST_LOCKOUT", 400);
  }

  const normalized = entries.join("\n");
  await Setting.sequelize.transaction(async transaction => {
    // Serialize competing administrator edits and commit the two settings together.
    await Company.findByPk(companyId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    // Keep the writes ordered inside the database transaction.
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of [
      ["ipAllowlist", normalized],
      ["ipAllowlistEnabled", enabled ? "enabled" : "disabled"]
    ]) {
      const [setting] = await Setting.findOrCreate({
        where: { companyId, key },
        defaults: { companyId, key, value },
        transaction
      });
      await setting.update({ value }, { transaction });
    }
  });
  return { enabled, text: normalized, entries };
};
