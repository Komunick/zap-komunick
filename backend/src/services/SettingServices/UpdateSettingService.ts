import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Setting from "../../models/Setting";
import { updateDefaultLanguage } from "../TranslationServices/i18nService";
import { safeSettingsKeys } from "./GetSettingService";
import { isCredentialKey } from "../../helpers/CredentialRules";

interface Request {
  key: string;
  value: string;
  companyId: number;
}

const UpdateSettingService = async ({
  key,
  value,
  companyId
}: Request): Promise<Setting | undefined> => {
  if (isCredentialKey(key)) {
    throw new AppError("ERR_USE_CREDENTIALS_ROUTE", 400);
  }
  if (
    key === "aiAssistantEnabled" &&
    !["enabled", "disabled"].includes(value)
  ) {
    throw new AppError("ERR_ASSISTANT_INVALID_REQUEST", 400);
  }
  if (key === "acessoriasEnabled" && !["enabled", "disabled"].includes(value)) {
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
  }
  if (key === "sciEnabled" && !["enabled", "disabled"].includes(value)) {
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
  }
  const [setting] = await Setting.findOrCreate({
    where: {
      key,
      companyId
    },
    defaults: {
      key,
      value,
      companyId
    }
  });

  if (setting != null && setting?.companyId !== companyId) {
    throw new AppError("Não é possível consultar registros de outra empresa");
  }

  if (!setting) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  await setting.update({ value });

  // P1: legacy Settings allows duplicate keys. A successful toggle must converge them.
  if (["aiAssistantEnabled", "acessoriasEnabled", "sciEnabled"].includes(key)) {
    await Setting.update({ value }, { where: { companyId, key } });
  }

  if (setting.key === "defaultLanguage" && companyId === 1) {
    updateDefaultLanguage(value);
  }

  if (setting.key in safeSettingsKeys) {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit("settings", {
      key: setting.key,
      value: setting.value
    });
  }

  return setting;
};

export default UpdateSettingService;
