import { NextFunction, Request, Response } from "express";
import credentialErrorHandler from "../../middleware/credentialErrorHandler";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";

jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

describe("credential request errors before generic telemetry/logging", () => {
  const canary = "FICTITIOUS_INVALID_JSON_CANARY";
  const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });

  beforeEach(() => jest.clearAllMocks());

  it.each([
    "/credentials/openAiKey",
    "/Credentials/openAiKey",
    "/settings/openAiKey",
    "/settings/%6fpenAiKey?bad=%XX"
  ])("never logs the parser's original body or message: %s", url => {
    const err = Object.assign(new SyntaxError(`Invalid token: ${canary}`), {
      body: `{invalid:${canary}}`,
      status: 400,
      type: "entity.parse.failed"
    });
    const res = response();
    const next = jest.fn();
    credentialErrorHandler(
      err,
      { originalUrl: url } as Request,
      res as unknown as Response,
      next
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "ERR_INVALID_CREDENTIAL_REQUEST"
    });
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      canary
    );
  });

  it("returns safe codes for storage faults and preserves approved application errors", () => {
    const res = response();
    credentialErrorHandler(
      new Error(canary),
      { originalUrl: "/credentials" } as Request,
      res as unknown as Response,
      jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "ERR_CREDENTIAL_REQUEST_FAILED"
    });
    credentialErrorHandler(
      new AppError("ERR_CREDENTIAL_MIGRATION_CONFLICT", 409),
      { originalUrl: "/credentials/migrate" } as Request,
      res as unknown as Response,
      jest.fn()
    );
    expect(res.status).toHaveBeenLastCalledWith(409);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "ERR_CREDENTIAL_MIGRATION_CONFLICT"
    });
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      canary
    );
  });

  it("leaves unrelated errors to their existing handler", () => {
    const err = new Error("fixture failure");
    const next = jest.fn() as NextFunction;
    credentialErrorHandler(
      err,
      { originalUrl: "/tickets/301" } as Request,
      response() as unknown as Response,
      next
    );
    expect(next).toHaveBeenCalledWith(err);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    "/tickets/301/acessorias/links",
    "/Tickets/301/Acessorias/status",
    "/tickets/301/%61cessorias/links?bad=%XX",
    "/settings/acessoriasEnabled"
  ])(
    "rejects malformed Acessorias bodies without logging customer data: %s",
    url => {
      const err = Object.assign(new SyntaxError(canary), {
        body: canary,
        status: 400
      });
      const res = response();
      const next = jest.fn();
      credentialErrorHandler(
        err,
        { originalUrl: url } as Request,
        res as unknown as Response,
        next
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "ERR_ACESSORIAS_INVALID_REQUEST"
      });
      expect(next).not.toHaveBeenCalled();
      expect(
        JSON.stringify((logger.warn as jest.Mock).mock.calls)
      ).not.toContain(canary);
    }
  );

  it.each([
    "/tickets/301/assistant",
    "/Tickets/301/Assistant",
    "/tickets/301/%61ssistant?bad=%XX",
    "/settings/aiAssistantEnabled"
  ])(
    "rejects malformed assistant JSON without logging conversation bodies: %s",
    url => {
      const err = Object.assign(new SyntaxError(canary), {
        body: canary,
        status: 400
      });
      const res = response();
      const next = jest.fn();
      credentialErrorHandler(
        err,
        { originalUrl: url } as Request,
        res as unknown as Response,
        next
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "ERR_ASSISTANT_INVALID_REQUEST"
      });
      expect(next).not.toHaveBeenCalled();
      expect(
        JSON.stringify((logger.warn as jest.Mock).mock.calls)
      ).not.toContain(canary);
    }
  );
});
