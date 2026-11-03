import { ErrorRequestHandler } from "express";
import AppError from "../errors/AppError";
import { isCredentialRequest } from "../helpers/CredentialTelemetry";
import { logger } from "../utils/logger";

// Zap Komunick P0: body-parser failures can carry both the original body and
// excerpts in their message. Handle them before Sentry and the generic logger.
const credentialErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (!isCredentialRequest(req.originalUrl || req.url)) return next(error);

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
      : status === 400
        ? "ERR_INVALID_CREDENTIAL_REQUEST"
        : "ERR_CREDENTIAL_REQUEST_FAILED";

  logger.warn({ code, status }, "Credential request failed");
  return res.status(status).json({ error: code });
};

export default credentialErrorHandler;
