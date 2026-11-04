import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import securityRoutes from "../../routes/securityRoutes";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import * as tokens from "../../helpers/CreateTokens";
import * as cookies from "../../helpers/SendRefreshToken";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";
import {
  confirmSetup,
  disableTwoFactor
} from "../../services/SecurityServices/TwoFactorService";

// Exercise the actual security routes/controller/JWT/cookie path. A successful
// 2FA mutation increments the fictitious database row's version just as the real
// service does; it must never convert a delegated access token into normal jrt.
jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: {
    secret: "fictional-security-rotation-access",
    refreshSecret: "fictional-security-rotation-refresh",
    expiresIn: "15m",
    refreshExpiresIn: "7d"
  }
}));
jest.mock("../../models/User", () => {
  const model = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    unscoped: jest.fn()
  };
  model.unscoped.mockReturnValue(model);
  return model;
});
jest.mock("../../models/Company", () => ({}));
jest.mock("../../models/Setting", () => ({}));
jest.mock("../../controllers/SessionController", () => ({
  verifyTwoFactor: jest.fn()
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn(),
  requestIp: jest.fn(() => "192.0.2.10")
}));
jest.mock("../../services/AuditServices/ListAuditLogsService", () => jest.fn());
jest.mock("../../services/SecurityServices/IpAllowlistService", () => ({
  getAllowlist: jest.fn(),
  saveAllowlist: jest.fn(),
  checkSignInIp: jest.fn()
}));
jest.mock("../../services/SecurityServices/TwoFactorService", () => ({
  confirmSetup: jest.fn(),
  disableTwoFactor: jest.fn(),
  newRecoveryCodes: jest.fn(),
  resetTwoFactor: jest.fn(),
  startSetup: jest.fn()
}));

interface Actor {
  id: number;
  companyId: number;
  profile: string;
  super: boolean;
  tokenVersion: number;
  twoFactorEnabled: boolean;
}
const key = "fictional-security-rotation-access";
const refreshKey = "fictional-security-rotation-refresh";
const accessSpy = jest.spyOn(tokens, "createAccessToken");
const refreshSpy = jest.spyOn(tokens, "createRefreshToken");
const cookieSpy = jest.spyOn(cookies, "SendRefreshToken");
const previousBackendUrl = process.env.BACKEND_URL;
let actor: Actor;
const app = express();
app.use(express.json());
app.use(securityRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);
const bearer = (
  claims: Record<string, unknown> = {},
  secret = key,
  lifetime = 300
) =>
  sign(
    {
      id: 201,
      companyId: 20,
      profile: "admin",
      super: false,
      impersonated: false,
      ...claims
    },
    secret,
    { expiresIn: lifetime }
  );
const delegated = {
  impersonated: true,
  originalUserId: 103,
  originalCompanyId: 10,
  originalTokenVersion: 0
};
type Operation = "enable" | "disable";
const call = (operation: Operation, token?: string) => {
  const pending = request(app).post(`/security/2fa/${operation}`);
  if (token) pending.set("Authorization", `Bearer ${token}`);
  return pending.send({
    code: "FICTITIOUS-2FA-CODE",
    password: "FICTITIOUS-2FA-PASSWORD"
  });
};
function noNormalSession(response, clearRequired = false) {
  expect(accessSpy).not.toHaveBeenCalled();
  expect(refreshSpy).not.toHaveBeenCalled();
  expect(cookieSpy).not.toHaveBeenCalled();
  expect(response.body).not.toHaveProperty("token");
  const setCookies: string[] = response.headers["set-cookie"] || [];
  setCookies.forEach(cookie => expect(cookie).toMatch(/^jrt=;/));
  if (clearRequired)
    expect(setCookies.some(cookie => cookie.startsWith("jrt=;"))).toBe(true);
}
beforeAll(() => {
  process.env.BACKEND_URL = "http://superchat.example.test";
});
afterAll(() => {
  if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = previousBackendUrl;
});
beforeEach(() => {
  jest.clearAllMocks();
  actor = {
    id: 201,
    companyId: 20,
    profile: "admin",
    super: false,
    tokenVersion: 7,
    twoFactorEnabled: false
  };
  (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
    actor && actor.id === where.id && actor.companyId === where.companyId
      ? actor
      : null
  );
  (confirmSetup as jest.Mock).mockImplementation(async user => {
    user.tokenVersion += 1;
    user.twoFactorEnabled = true;
    return ["FAKE-1234"];
  });
  (disableTwoFactor as jest.Mock).mockImplementation(async user => {
    user.tokenVersion += 1;
    user.twoFactorEnabled = false;
  });
});

describe.each(["enable", "disable"] as const)(
  "POST /security/2fa/%s refresh rotation",
  operation => {
    it("preserves normal refresh rotation with the updated database token version", async () => {
      const response = await call(operation, bearer());
      expect(response.status).toBe(200);
      const rawCookies: unknown = response.headers["set-cookie"];
      const setCookies: string[] = Array.isArray(rawCookies)
        ? rawCookies
        : typeof rawCookies === "string"
          ? [rawCookies]
          : [];
      const setCookie = setCookies.find(cookie => cookie.startsWith("jrt="));
      expect(setCookie).toBeDefined();
      const claims = verify(
        setCookie.split(";", 1)[0].slice(4),
        refreshKey
      ) as JwtPayload;
      expect(claims).toMatchObject({
        id: 201,
        companyId: 20,
        tokenVersion: 8,
        impersonated: false
      });
      expect(claims).not.toHaveProperty("originalUserId");
      expect(claims).not.toHaveProperty("originalTokenVersion");
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(cookieSpy).toHaveBeenCalledTimes(1);
      expect(auditRequest).toHaveBeenCalledTimes(1);
    });
    it.each([
      { name: "bounded delegated access", claims: delegated },
      {
        name: "legacy delegated access",
        claims: { ...delegated, originalTokenVersion: undefined }
      },
      {
        name: "different origin identity",
        claims: { ...delegated, originalUserId: 999, originalCompanyId: 30 }
      },
      { name: "missing origin metadata", claims: { impersonated: true } }
    ])(
      "clears refresh after a successful mutation from $name",
      async ({ claims }) => {
        const response = await call(operation, bearer(claims));
        expect(response.status).toBe(200);
        expect(actor.tokenVersion).toBe(8);
        expect(
          operation === "enable" ? confirmSetup : disableTwoFactor
        ).toHaveBeenCalledTimes(1);
        noNormalSession(response, true);
        expect(auditRequest).toHaveBeenCalledTimes(1);
      }
    );
    it.each([false, true])(
      "does not issue cookies or audit success after 2FA failure (delegated=%s)",
      async impersonated => {
        const failure = new AppError("ERR_2FA_INVALID_CODE", 401);
        (
          (operation === "enable"
            ? confirmSetup
            : disableTwoFactor) as jest.Mock
        ).mockRejectedValue(failure);
        const response = await call(
          operation,
          bearer(impersonated ? delegated : {})
        );
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "ERR_2FA_INVALID_CODE" });
        expect(actor.tokenVersion).toBe(7);
        noNormalSession(response);
        expect(response.headers["set-cookie"]).toBeUndefined();
        expect(auditRequest).not.toHaveBeenCalled();
      }
    );
    it("does not accept a stale profile before mutating 2FA", async () => {
      actor.profile = "user";
      const response = await call(operation, bearer(delegated));
      expect(response.status).toBe(403);
      expect(confirmSetup).not.toHaveBeenCalled();
      expect(disableTwoFactor).not.toHaveBeenCalled();
      noNormalSession(response);
      expect(auditRequest).not.toHaveBeenCalled();
    });
    it.each([
      { token: undefined, status: 401 },
      { token: bearer(delegated, "fictional-wrong-key"), status: 403 },
      { token: bearer(delegated, key, -1), status: 403 }
    ])(
      "rejects missing or invalid access with status $status",
      async ({ token, status }) => {
        const response = await call(operation, token);
        expect(response.status).toBe(status);
        expect(confirmSetup).not.toHaveBeenCalled();
        expect(disableTwoFactor).not.toHaveBeenCalled();
        noNormalSession(response);
        expect(auditRequest).not.toHaveBeenCalled();
      }
    );
  }
);
