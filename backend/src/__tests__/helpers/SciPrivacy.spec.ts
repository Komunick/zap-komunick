import { Request, Response } from "express";
import {
  isSciRequest,
  isSensitiveRequest
} from "../../helpers/CredentialTelemetry";
import credentialErrorHandler from "../../middleware/credentialErrorHandler";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";

jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

const urls = [
  "/tickets/301/sci/status",
  "/tickets/301/sci/clients/mock-001?page=2",
  "/tickets/301/sci/links",
  "/Tickets/301/SCI/catalog",
  "/tickets/301/%73ci/links?bad=%XX",
  "/tickets/1%2Fextra/%73ci/links?bad=%XX",
  "/tickets/1%XX/%73ci/links",
  "/settings/sciEnabled",
  "/Settings/%73ciEnabled?bad=%XX"
];

describe("SCI content is private even when the route/parser rejects the request", () => {
  const canary = "FICTITIOUS_SCI_DOCUMENT_CANARY";
  const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });
  beforeEach(() => jest.clearAllMocks());

  it.each(urls)("classifies and safely handles malformed JSON at %s", url => {
    expect(isSciRequest(url)).toBe(true);
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
    expect(res.json).toHaveBeenCalledWith({ error: "ERR_SCI_INVALID_REQUEST" });
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      canary
    );
  });

  it.each(urls)(
    "masks unexpected failures while preserving safe SCI application codes at %s",
    url => {
      const req = { originalUrl: url } as Request;
      const res = response();
      credentialErrorHandler(
        new Error(canary),
        req,
        res as unknown as Response,
        jest.fn()
      );
      expect(res.status).toHaveBeenLastCalledWith(500);
      expect(res.json).toHaveBeenLastCalledWith({
        error: "ERR_SCI_UNAVAILABLE"
      });
      credentialErrorHandler(
        new AppError("ERR_SCI_CONTEXT_CHANGED", 409),
        req,
        res as unknown as Response,
        jest.fn()
      );
      expect(res.status).toHaveBeenLastCalledWith(409);
      expect(res.json).toHaveBeenLastCalledWith({
        error: "ERR_SCI_CONTEXT_CHANGED"
      });
      expect(
        JSON.stringify((logger.warn as jest.Mock).mock.calls)
      ).not.toContain(canary);
    }
  );

  it.each([
    undefined,
    "/tickets/301",
    "/tickets/301/sci-other",
    "/settings/sciEnabledOther",
    "/tickets/301/acessorias/status"
  ])("preserves classification of unrelated routes: %s", url =>
    expect(isSciRequest(url)).toBe(false)
  );
});
