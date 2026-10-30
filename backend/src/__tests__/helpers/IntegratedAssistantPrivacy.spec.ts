import { Request, Response } from "express";
import AppError from "../../errors/AppError";
import {
  isIntegratedAssistantRequest,
  isSensitiveRequest
} from "../../helpers/CredentialTelemetry";
import credentialErrorHandler from "../../middleware/credentialErrorHandler";
import { logger } from "../../utils/logger";

jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

const urls = [
  "/tickets/301/integrated-assistant",
  "/tickets/301/integrated-assistant/status",
  "/tickets/301/integrated-assistant/clients",
  "/tickets/301/integrated-assistant/review",
  "/Tickets/301/Integrated-Assistant/review",
  "/tickets/301/%69ntegrated-assistant?bad=%XX",
  "/tickets/1%2Fextra/%69ntegrated-assistant/review?bad=%XX",
  "/tickets/1%XX/%69ntegrated-assistant",
  "/settings/integratedAssistantEnabled",
  "/Settings/%69ntegratedAssistantEnabled?bad=%XX"
];

describe("P4 bodies and selected source metadata remain outside remote telemetry", () => {
  const canary = "FICTITIOUS_INTEGRATED_CONTEXT_CANARY";
  const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });
  beforeEach(() => jest.clearAllMocks());
  it.each(urls)("classifies and safely handles malformed JSON at %s", url => {
    expect(isIntegratedAssistantRequest(url)).toBe(true);
    expect(isSensitiveRequest(url)).toBe(true);
    const error = Object.assign(new SyntaxError(canary), {
      body: canary,
      status: 400,
      type: "entity.parse.failed"
    });
    const res = response();
    const next = jest.fn();
    credentialErrorHandler(
      error,
      { originalUrl: url } as Request,
      res as unknown as Response,
      next
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "ERR_INTEGRATED_ASSISTANT_INVALID_REQUEST"
    });
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      canary
    );
  });
  it.each(urls)(
    "hides unexpected payloads and keeps stable permission/context codes at %s",
    url => {
      const res = response();
      credentialErrorHandler(
        new Error(canary),
        { originalUrl: url } as Request,
        res as unknown as Response,
        jest.fn()
      );
      expect(res.status).toHaveBeenLastCalledWith(500);
      expect(res.json).toHaveBeenLastCalledWith({
        error: "ERR_INTEGRATED_ASSISTANT_UNAVAILABLE"
      });
      credentialErrorHandler(
        new AppError("ERR_INTEGRATED_ASSISTANT_CONTEXT_CHANGED", 409),
        { originalUrl: url } as Request,
        res as unknown as Response,
        jest.fn()
      );
      expect(res.status).toHaveBeenLastCalledWith(409);
      expect(res.json).toHaveBeenLastCalledWith({
        error: "ERR_INTEGRATED_ASSISTANT_CONTEXT_CHANGED"
      });
      expect(
        JSON.stringify((logger.warn as jest.Mock).mock.calls)
      ).not.toContain(canary);
    }
  );
  it.each([
    undefined,
    "/tickets/301",
    "/tickets/301/integrated-assistant-other",
    "/settings/integratedAssistantEnabledOther",
    "/tickets/301/assistant"
  ])("preserves unrelated routes %s", url =>
    expect(isIntegratedAssistantRequest(url)).toBe(false)
  );
});
