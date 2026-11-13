import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Setting from "../../models/Setting";
import { updateDefaultLanguage } from "../TranslationServices/i18nService";
import { safeSettingsKeys } from "./GetSettingService";
import { isCredentialKey } from "../../helpers/CredentialRules";
import {
  GENERAL_TRIAGE_QUEUE,
  GENERAL_TRIAGE_TIMEOUT,
  parseGeneralTriageInteger
} from "../../helpers/GeneralTriage";
import Queue from "../../models/Queue";

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
  if (
    key === "integratedAssistantEnabled" &&
    !["enabled", "disabled"].includes(value)
  ) {
    throw new AppError("ERR_INTEGRATED_ASSISTANT_INVALID_REQUEST", 400);
  }
  if (key === GENERAL_TRIAGE_QUEUE && value !== "" && value !== "0") {
    const id = parseGeneralTriageInteger(value, 2147483647);
    if (!id || !(await Queue.findOne({ where: { id, companyId } }))) {
      throw new AppError("ERR_GENERAL_TRIAGE_INVALID_QUEUE", 400);
    }
  }
  if (
    key === GENERAL_TRIAGE_TIMEOUT &&
    !parseGeneralTriageInteger(value, 1440)
  ) {
    throw new AppError("ERR_GENERAL_TRIAGE_INVALID_TIMEOUT", 400);
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
  if (
    [
      "aiAssistantEnabled",
      "acessoriasEnabled",
      "sciEnabled",
      "integratedAssistantEnabled",
      GENERAL_TRIAGE_QUEUE,
      GENERAL_TRIAGE_TIMEOUT
    ].includes(key)
  ) {
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
