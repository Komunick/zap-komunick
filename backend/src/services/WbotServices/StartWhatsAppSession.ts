import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";
import { sendWhatsappUpdate } from "../WhatsappService/SocketSendWhatsappUpdate";
import { getWhatsAppProxyAgent } from "../../helpers/WhatsAppProxyAgent";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number,
  isRefresh = false,
  { propagateErrors = false } = {}
): Promise<void> => {
  let proxy: ReturnType<typeof getWhatsAppProxyAgent>;
  try {
    proxy = getWhatsAppProxyAgent();
  } catch (err) {
    if (propagateErrors) throw err;
    logger.error(err);
    return;
  }

  await whatsapp.update({ status: "OPENING" });

  sendWhatsappUpdate(whatsapp);

  try {
    const wbot = await initWASocket(whatsapp, proxy, isRefresh);
    if (!wbot) return;
    wbotMessageListener(wbot, companyId);
    wbotMonitor(wbot, whatsapp, companyId);
  } catch (err) {
    if (propagateErrors) throw err;
    logger.error(err);
  }
};
