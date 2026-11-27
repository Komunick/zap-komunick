import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import { isCredentialKey } from "../../helpers/CredentialRules";
import {
  FORCE_MESSAGE_SIGNATURE,
  isMessageSignatureRequired
} from "../../helpers/MessageSignature";
import { loadTicketViewer } from "../TicketServices/AuthorizeTicketContextService";

interface Request {
  key: string;
  user: {
    id?: string | number;
    profile: string;
    companyId: number;
  };
}

// keys that can be accessed by non-admin users
// with respective default values
export const safeSettingsKeys = {
  aiAssistantEnabled: "disabled",
  integratedAssistantEnabled: "disabled",
  acessoriasEnabled: "disabled",
  sciEnabled: "disabled",
  groupsTab: "disabled",
  CheckMsgIsGroup: "disabled",
  soundGroupNotifications: "disabled",
  tagsMode: "ticket",
  slaMinutes: "0",
  closeReasonRequired: "disabled",
  [FORCE_MESSAGE_SIGNATURE]: "disabled",
  allowSilentlyClose: "enabled",
  // Zap Komunick (RF-034): whether who finishes is asked about the completion
  // message; the ticket screen needs it to know if it has to ask.
  completionMessagePrompt: "disabled",
  // Zap Komunick (RF-033): which queue is the general one, so the ticket
  // list can apply its queue filter to the conversations waiting for a sector.
  generalTriageQueueId: ""
};

export const GetSettingService = async ({
  key,
  user
}: Request): Promise<string> => {
  if (user.profile !== "admin" && !(key in safeSettingsKeys)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (isCredentialKey(key)) return "";

  if (key === FORCE_MESSAGE_SIGNATURE) {
    if (user.id === undefined) throw new AppError("ERR_NO_PERMISSION", 403);
    await loadTicketViewer({ userId: user.id, companyId: user.companyId });
    return (await isMessageSignatureRequired(user.companyId))
      ? "enabled"
      : "disabled";
  }

  // P3 status is metadata of the current company, never a grant from an old JWT.
  if (["sciEnabled", "integratedAssistantEnabled"].includes(key)) {
    if (user.id === undefined) throw new AppError("ERR_NO_PERMISSION", 403);
    await loadTicketViewer({ userId: user.id, companyId: user.companyId });
    const rows = await Setting.findAll({
      where: { companyId: user.companyId, key },
      attributes: ["value"],
      logging: false
    });
    return rows.length > 0 && rows.every(row => row.value === "enabled")
      ? "enabled"
      : "disabled";
  }

  const setting = await Setting.findOne({
    where: {
      companyId: user.companyId,
      key
    }
  });

  if (!setting && key in safeSettingsKeys) {
    return safeSettingsKeys[key];
  }

  return setting?.value || "";
};
