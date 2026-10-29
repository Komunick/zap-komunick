import { ErrorRequestHandler } from "express";
import AppError from "../errors/AppError";
import {
  isAcessoriasRequest,
  isAssistantRequest,
  isAttachmentRequest,
  isSciRequest,
  isSensitiveRequest
} from "../helpers/CredentialTelemetry";
import { logger } from "../utils/logger";

// Zap Komunick P0: body-parser failures can carry both the original body and
// excerpts in their message. Handle them before Sentry and the generic logger.
const credentialErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const url = req.originalUrl || req.url;
  if (!isSensitiveRequest(url)) return next(error);
  const assistant = isAssistantRequest(url);
  const acessorias = isAcessoriasRequest(url);
  const sci = isSciRequest(url);
  const attachment = isAttachmentRequest(url);

  const requestedStatus = Number(error.statusCode || error.status);
  const status =
    error instanceof AppError
      ? error.statusCode
      : [400, 413, 415].includes(requestedStatus)
        ? requestedStatus
        : 500;
  const code =
    error instanceof AppError && /^ERR_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : attachment
        ? [400, 413, 415].includes(status)
          ? "ERR_ATTACHMENT_INVALID_REQUEST"
          : "ERR_ATTACHMENT_UNAVAILABLE"
        : sci
          ? [400, 413, 415].includes(status)
            ? "ERR_SCI_INVALID_REQUEST"
            : "ERR_SCI_UNAVAILABLE"
          : acessorias
            ? status === 400 || status === 413 || status === 415
              ? "ERR_ACESSORIAS_INVALID_REQUEST"
              : "ERR_ACESSORIAS_UNAVAILABLE"
            : assistant
              ? status === 400 || status === 413 || status === 415
                ? "ERR_ASSISTANT_INVALID_REQUEST"
                : "ERR_ASSISTANT_UNAVAILABLE"
              : status === 400
                ? "ERR_INVALID_CREDENTIAL_REQUEST"
                : "ERR_CREDENTIAL_REQUEST_FAILED";

  logger.warn(
    { code, status },
    attachment
      ? "Attachment request failed"
      : sci
        ? "SCI request failed"
        : acessorias
          ? "Acessorias request failed"
          : assistant
            ? "Assistant request failed"
            : "Credential request failed"
  );
  return res.status(status).json({ error: code });
};

export default credentialErrorHandler;
