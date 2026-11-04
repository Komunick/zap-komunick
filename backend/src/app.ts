import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";

import "./database";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";
import { messageQueue, sendScheduledMessages } from "./queues";
import { corsOrigin } from "./helpers/corsOrigin";
import { isSensitiveRequest } from "./helpers/CredentialTelemetry";
import credentialErrorHandler from "./middleware/credentialErrorHandler";
import servePublicFile from "./services/PublicFileService";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Zap Komunick P0: remote telemetry must never receive credential write bodies.
  beforeSend: event => (isSensitiveRequest(event.request?.url) ? null : event)
});

const app = express();

// Zap Komunick: the real client IP (audit trail and IP allowlist, RF-016)
// trusts forwarded headers only when the deployment explicitly names its proxies.
app.set("trust proxy", process.env.TRUST_PROXY || false);

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

app.use(
  cors({
    credentials: true,
    origin: corsOrigin,
    exposedHeaders: [
      "Content-Range",
      "X-Content-Range",
      "Date",
      "Accept-Ranges",
      "Content-Length"
    ]
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(Sentry.Handlers.requestHandler());
app.get("/public/*", servePublicFile);

app.use((req, _res, next) => {
  const { method, path: requestPath } = req;
  logger.trace({ method, path: requestPath }, "Incoming request");
  next();
});

app.use(routes);

app.use(credentialErrorHandler);
app.use(Sentry.Handlers.errorHandler());
app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    if (err.message === "ERR_2FA_TOO_MANY_ATTEMPTS") {
      res.setHeader("Retry-After", "600");
    }
    logger[err.level](err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
