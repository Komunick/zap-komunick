import request from "supertest";
import * as Sentry from "@sentry/node";
import app from "../../app";
import { logger } from "../../utils/logger";

jest.mock("../../database", () => ({}));
jest.mock("../../queues", () => ({}));
jest.mock("../../config/auth", () => ({ secret: "fictional-auth-key" }));
jest.mock("../../models/User", () => ({}));
jest.mock("../../libs/cache", () => ({
  cacheLayer: { get: jest.fn(async () => null) }
}));
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), trace: jest.fn() }
}));
jest.mock("@sentry/node", () => ({
  init: jest.fn(),
  Handlers: {
    requestHandler: () => (_req, _res, next) => next(),
    errorHandler: jest.fn(() => jest.fn((err, _req, _res, next) => next(err)))
  }
}));
jest.mock("../../services/PublicFileService", () => jest.fn());
// Replace controller I/O, retaining the actual application error chain and the
// real setup service. No application server, database or WhatsApp is started.
jest.mock("../../routes", () => {
  const router = jest.requireActual("express").Router();
  const AppError = jest.requireActual("../../errors/AppError").default;
  router.post("/security/2fa/setup", async (req, res) => {
    const { startSetup } = jest.requireActual(
      "../../services/SecurityServices/TwoFactorService"
    );
    await startSetup({
      id: 11,
      email: "fictional@example.test",
      twoFactorEnabled: false,
      update: async values => {
        const { DatabaseError } = jest.requireActual("sequelize");
        const error = new DatabaseError(
          Object.assign(new Error("fictional persistence failure"), {
            sql: 'UPDATE "Users" SET "twoFactorPendingSecret" = $1',
            parameters: [values.twoFactorPendingSecret]
          })
        );
        req.app.locals.fixturePersistenceError = error;
        throw error;
      }
    });
    res.json({});
  });
  router.post("/auth/login", () => {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  });
  router.post("/auth/2fa", () => {
    throw new AppError("ERR_2FA_TOO_MANY_ATTEMPTS", 429);
  });
  router.post("/security/2fa/enable", () => {
    throw new AppError("ERR_2FA_INVALID_CODE", 401);
  });
  router.delete("/users/:userId/2fa", () => {
    throw new AppError("ERR_NO_PERMISSION", 403);
  });
  router.get("/fixture-unrelated", () => {
    throw new Error("FICTITIOUS_UNRELATED_DIAGNOSTIC");
  });
  return router;
});

const sentryBeforeSend = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
const sentryErrorHandler = (Sentry.Handlers.errorHandler as jest.Mock).mock
  .results[0].value as jest.Mock;
const canary = "FICTITIOUS-SECURITY-TRANSPORT-CANARY";

beforeEach(() => {
  jest.clearAllMocks();
  delete app.locals.fixturePersistenceError;
});

it.each([
  ["post", "/auth/login"],
  ["post", "/auth/2fa"],
  ["post", "/security/2fa/disable"],
  ["post", "/security/%32fa/recovery-codes?bad=%XX"],
  ["delete", "/users/11/2fa"]
])(
  "sanitizes malformed %s %s before Sentry and raw logging",
  async (method, path) => {
    const agent = request(app);
    const operation =
      method === "delete" ? agent.delete(path) : agent.post(path);
    const response = await operation
      .set("Content-Type", "application/json")
      .send(`{"password":"${canary}","code":"FAKE-CODE",invalid}`);

    expect(logger.error).not.toHaveBeenCalled();
    expect(sentryErrorHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "ERR_SECURITY_INVALID_REQUEST" });
    expect(logger.warn).toHaveBeenCalledWith(
      { code: "ERR_SECURITY_INVALID_REQUEST", status: 400 },
      "Security request failed"
    );
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      canary
    );
  }
);

it("contains the actual setup service's ORM secret before either error sink", async () => {
  const response = await request(app).post("/security/2fa/setup").send({});
  const error = app.locals.fixturePersistenceError;
  expect(error.name).toBe("SequelizeDatabaseError");
  expect(error.parameters[0]).toMatch(/^[A-Z2-7]{32}$/);
  expect(error.sql).toContain("twoFactorPendingSecret");
  expect(logger.error).not.toHaveBeenCalled();
  expect(sentryErrorHandler).not.toHaveBeenCalled();
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: "ERR_SECURITY_REQUEST_FAILED" });
  expect(logger.warn).toHaveBeenCalledWith(
    { code: "ERR_SECURITY_REQUEST_FAILED", status: 500 },
    "Security request failed"
  );
  const observations = JSON.stringify([
    response.body,
    (logger.warn as jest.Mock).mock.calls
  ]);
  expect(observations).not.toContain(error.parameters[0]);
  expect(observations).not.toContain("twoFactorPendingSecret");
  expect(observations).not.toContain(error.message);
});

it.each([
  "/auth/login",
  "/auth/2fa",
  "/security/2fa/disable",
  "/users/11/2fa",
  "/audit-logs",
  "/%73ecurity/%32fa/disable?bad=%XX"
])("drops sensitive events in the real app Sentry filter: %s", path => {
  const event = {
    request: {
      url: `https://example.invalid/backend${path}`,
      data: { password: canary, code: "FAKE-CODE", secret: "FAKE-SECRET" }
    }
  };
  expect(sentryBeforeSend(event)).toBeNull();
});

it.each<[string, string, number, string]>([
  ["post", "/auth/login", 401, "ERR_INVALID_CREDENTIALS"],
  ["post", "/security/2fa/enable", 401, "ERR_2FA_INVALID_CODE"],
  ["delete", "/users/11/2fa", 403, "ERR_NO_PERMISSION"]
])(
  "preserves known application errors for %s %s",
  async (method, path, status, code) => {
    const agent = request(app);
    const response = await (
      method === "delete" ? agent.delete(path) : agent.post(path)
    ).send({});
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: code });
  }
);

it("preserves the second-factor lock status, safe code and Retry-After", async () => {
  const response = await request(app)
    .post("/auth/2fa")
    .send({ code: "FAKE-CODE" });
  expect(response.status).toBe(429);
  expect(response.body).toEqual({ error: "ERR_2FA_TOO_MANY_ATTEMPTS" });
  expect(response.headers["retry-after"]).toBe("600");
});

it("keeps unrelated generic error diagnostics and Sentry behavior", async () => {
  const response = await request(app).get("/fixture-unrelated");
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: "Internal server error" });
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ message: "FICTITIOUS_UNRELATED_DIAGNOSTIC" })
  );
  expect(sentryErrorHandler).toHaveBeenCalledTimes(1);
  const event = { request: { url: "https://example.invalid/tickets/301" } };
  expect(sentryBeforeSend(event)).toBe(event);
});
