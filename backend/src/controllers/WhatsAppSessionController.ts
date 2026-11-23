import { Request, Response } from "express";
import {
  getWbot,
  removeWbot,
  resolvePasskeyToken,
  createCaptureToken
} from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import ImportWhatsAppSessionService from "../services/WbotServices/ImportWhatsAppSessionService";
import { startBuildCaptureExtension } from "../services/WbotServices/BuildCaptureExtensionService";
import { sendWhatsappUpdate } from "../services/WhatsappService/SocketSendWhatsappUpdate";
import AppError from "../errors/AppError";
import { getWhatsAppProxyAgent } from "../helpers/WhatsAppProxyAgent";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import BaileysKeys from "../models/BaileysKeys";
import Whatsapp from "../models/Whatsapp";

const whatsappChannelScope = (req: Request) => {
  const id = Number(req.params.whatsappId);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return { id, companyId: req.user.companyId, channel: "whatsapp" };
};

const showQr = async (req: Request, res: Response): Promise<Response> => {
  res.setHeader("Cache-Control", "private, no-store");

  const whatsapp = await Whatsapp.findOne({
    attributes: ["status", "qrcode"],
    where: whatsappChannelScope(req)
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return res.status(200).json({
    status: whatsapp.status,
    qrcode: whatsapp.status === "qrcode" ? whatsapp.qrcode : null
  });
};

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (whatsapp && whatsapp.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  await StartWhatsAppSession(whatsapp, companyId);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const where = whatsappChannelScope(req);
  const channel = await Whatsapp.findOne({
    attributes: ["status"],
    where
  });

  if (!channel) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }
  if (channel.status !== "DISCONNECTED") {
    throw new AppError("ERR_WAPP_NOT_DISCONNECTED", 409);
  }

  // Validate the configured route before claiming the connection attempt.
  try {
    getWhatsAppProxyAgent();
  } catch (err) {
    logger.error(err);
    throw new AppError("ERR_WAPP_START_FAILED", 503);
  }

  const [, [whatsapp]] = await Whatsapp.update(
    { status: "OPENING", session: "", qrcode: "" },
    { where: { ...where, status: "DISCONNECTED" }, returning: true }
  );
  if (!whatsapp) {
    throw new AppError("ERR_WAPP_NOT_DISCONNECTED", 409);
  }

  const openedAt = whatsapp.updatedAt;
  StartWhatsAppSession(whatsapp, where.companyId, false, {
    propagateErrors: true
  })
    .catch(async err => {
      logger.error(err);
      const [, [failed]] = await Whatsapp.update(
        { status: "DISCONNECTED" },
        {
          where: { ...where, status: "OPENING", updatedAt: openedAt },
          returning: true
        }
      );
      if (failed) sendWhatsappUpdate(failed);
    })
    .catch(err => logger.error(err));

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (whatsapp && whatsapp.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (whatsapp.channel === "whatsapp") {
    const wbot = getWbot(whatsapp.id);
    wbot.logout();
    wbot.ws.close();
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    whatsapp.destroy();
  }

  return res.status(200).json({ message: "Session disconnected." });
};

const refresh = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (whatsapp && whatsapp.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (whatsapp.channel === "whatsapp") {
    const wbot = getWbot(whatsapp.id);
    if (!wbot) {
      return res.status(404).json({ message: "Session not found." });
    }
    await wbot.ws.close();
    return res.status(200).json({ message: "Session refreshed." });
  }

  return res.status(400).json({ message: "Session not supported." });
};

const requestCaptureToken = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (whatsapp && whatsapp.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const token = createCaptureToken(whatsapp.id);

  try {
    const wbot = getWbot(whatsapp.id);
    wbot.ev.removeAllListeners("connection.update");
    wbot.end(null);
  } catch {
    // no active socket to terminate
  }

  await whatsapp.update({
    status: "passkey_required",
    qrcode: token,
    retries: 0
  });

  const io = getIO();
  io.to(`company-${whatsapp.companyId}-admin`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    {
      action: "update",
      session: whatsapp
    }
  );

  return res.status(200).json({ token });
};

const reset = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (whatsapp && whatsapp.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  await removeWbot(whatsapp.id, false);
  await BaileysKeys.destroy({ where: { whatsappId: whatsapp.id } });
  await whatsapp.update({
    status: "DISCONNECTED",
    qrcode: "",
    session: "",
    retries: 0
  });

  const io = getIO();
  io.to(`company-${whatsapp.companyId}-admin`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    {
      action: "update",
      session: whatsapp
    }
  );

  return res.status(200).json({ message: "Session reset." });
};

const capture = async (req: Request, res: Response): Promise<Response> => {
  const { token } = req.params;
  const whatsappId = resolvePasskeyToken(token);

  if (!whatsappId) {
    return res
      .status(404)
      .json({ message: "Invalid or expired capture token." });
  }

  const whatsapp = await ShowWhatsAppService(whatsappId.toString());
  if (!whatsapp) {
    return res.status(404).json({ message: "Session not found." });
  }

  const dump = req.body;
  if (!dump || typeof dump !== "object") {
    return res.status(400).json({ message: "Invalid dump payload." });
  }

  try {
    await whatsapp.update({
      status: "IMPORTING",
      qrcode: ""
    });

    const io = getIO();
    io.to(`company-${whatsapp.companyId}-admin`).emit(
      `company-${whatsapp.companyId}-whatsappSession`,
      {
        action: "update",
        session: whatsapp
      }
    );

    await removeWbot(whatsapp.id, false);
    await ImportWhatsAppSessionService(whatsapp, dump);

    await whatsapp.update({ status: "PENDING" });
    io.to(`company-${whatsapp.companyId}-admin`).emit(
      `company-${whatsapp.companyId}-whatsappSession`,
      {
        action: "update",
        session: whatsapp
      }
    );

    // Give the browser extension time to wipe the source WhatsApp Web
    // session before this backend tries to connect with the same credentials.
    setTimeout(async () => {
      try {
        await StartWhatsAppSession(whatsapp, whatsapp.companyId);
      } catch (startErr) {
        logger.error(
          { err: startErr, whatsappId: whatsapp.id },
          "Failed to start imported session"
        );
      }
    }, 5000);

    return res.status(200).json({
      message: "Session dump received and imported."
    });
  } catch (err) {
    logger.error({ err, whatsappId: whatsapp.id }, "Failed to import dump");
    await whatsapp.update({ status: "DISCONNECTED", qrcode: "", session: "" });
    await BaileysKeys.destroy({ where: { whatsappId: whatsapp.id } });
    const io = getIO();
    io.to(`company-${whatsapp.companyId}-admin`).emit(
      `company-${whatsapp.companyId}-whatsappSession`,
      {
        action: "update",
        session: whatsapp
      }
    );
    return res
      .status(500)
      .json({ message: err.message || "Failed to process dump." });
  }
};

/**
 * Triggers a background build of the WA Session Capture browser extension.
 *
 * The extension is built from the public zapitu/zapitu-wasession-capture
 * repository, whitelabeled with the configured app name, favicon and frontend
 * URL. The resulting zip is published under /public/capture-extension.zip and
 * the public setting extensionDownloadUrl is updated.
 *
 * Build progress is reported asynchronously via websocket on the
 * company-${companyId}-extensionBuild channel.
 */
const buildCaptureExtension = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const frontendUrl = process.env.FRONTEND_URL || req.headers.origin;

  startBuildCaptureExtension(companyId, frontendUrl);

  return res.status(202).json({ message: "Extension build started." });
};

export default {
  showQr,
  store,
  remove,
  update,
  refresh,
  capture,
  requestCaptureToken,
  buildCaptureExtension,
  reset
};
