import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import User from "../../models/User";
import routes from "../../routes/securityRoutes";
import AppError from "../../errors/AppError";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";
import ListAuditLogsService from "../../services/AuditServices/ListAuditLogsService";
import {
  getAllowlist,
  saveAllowlist
} from "../../services/SecurityServices/IpAllowlistService";
import {
  confirmSetup,
  disableTwoFactor,
  newRecoveryCodes,
  resetTwoFactor,
  startSetup
} from "../../services/SecurityServices/TwoFactorService";

jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: "fictional-security-route-key-not-a-real-secret" }
}));
jest.mock("../../models/User", () => {
  const model = {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    unscoped: jest.fn()
  };
  model.unscoped.mockReturnValue(model);
  return model;
});
jest.mock("../../controllers/SessionController", () => ({
  verifyTwoFactor: jest.fn()
}));
jest.mock("../../helpers/CreateTokens", () => ({
  createRefreshToken: jest.fn(() => "fictional-refresh")
}));
jest.mock("../../helpers/SendRefreshToken", () => ({
  SendRefreshToken: jest.fn()
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn(),
  requestIp: jest.fn(() => "192.0.2.1")
}));
jest.mock("../../services/AuditServices/ListAuditLogsService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/SecurityServices/IpAllowlistService", () => ({
  getAllowlist: jest.fn(),
  saveAllowlist: jest.fn()
}));
jest.mock("../../services/SecurityServices/TwoFactorService", () => ({
  confirmSetup: jest.fn(),
  disableTwoFactor: jest.fn(),
  newRecoveryCodes: jest.fn(),
  resetTwoFactor: jest.fn(),
  startSetup: jest.fn()
}));

const app = express();
app.use(express.json());
app.use(routes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

interface Actor {
  id: number;
  companyId: number;
  profile: string;
  super: boolean;
  twoFactorEnabled: boolean;
  twoFactorRecoveryCodes: string[];
}
type Method = "get" | "put" | "delete" | "post";
interface Operation {
  method: Method;
  path: string;
  administrative: boolean;
}
const operations: Operation[] = [
  { method: "get", path: "/security/me", administrative: false },
  { method: "post", path: "/security/2fa/setup", administrative: false },
  { method: "post", path: "/security/2fa/enable", administrative: false },
  {
    method: "post",
    path: "/security/2fa/recovery-codes",
    administrative: false
  },
  { method: "post", path: "/security/2fa/disable", administrative: false },
  { method: "delete", path: "/users/42/2fa", administrative: true },
  { method: "get", path: "/security/ip-allowlist", administrative: true },
  { method: "put", path: "/security/ip-allowlist", administrative: true },
  { method: "get", path: "/audit-logs", administrative: true }
];
let actor: Actor | null;
let target: { id: number; companyId: number; super: boolean; name: string };
const consumers = [
  auditRequest,
  ListAuditLogsService,
  getAllowlist,
  saveAllowlist,
  confirmSetup,
  disableTwoFactor,
  newRecoveryCodes,
  resetTwoFactor,
  startSetup
];
const bearer = (claims: Record<string, unknown> = {}) =>
  sign(
    { id: 11, companyId: 101, profile: "admin", super: false, ...claims },
    "fictional-security-route-key-not-a-real-secret",
    { expiresIn: "5m" }
  );
const call = (operation: Operation, token: string | false = bearer()) => {
  const pending = request(app)[operation.method](operation.path);
  if (token) pending.set("Authorization", `Bearer ${token}`);
  return pending.send({ enabled: false, text: "", code: "fictional-code" });
};
const expectNoSensitiveWork = () =>
  consumers.forEach(consumer => expect(consumer).not.toHaveBeenCalled());

beforeEach(() => {
  jest.clearAllMocks();
  actor = {
    id: 11,
    companyId: 101,
    profile: "admin",
    super: false,
    twoFactorEnabled: true,
    twoFactorRecoveryCodes: []
  };
  target = { id: 42, companyId: 101, super: false, name: "Fictitious target" };
  (User.findByPk as jest.Mock).mockImplementation(async id =>
    Number(id) === 42 ? { ...target } : actor ? { ...actor } : null
  );
  (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
    actor && actor.id === where.id && actor.companyId === where.companyId
      ? { ...actor }
      : null
  );
  (getAllowlist as jest.Mock).mockResolvedValue({
    enabled: false,
    entries: []
  });
  (saveAllowlist as jest.Mock).mockResolvedValue({
    enabled: false,
    entries: []
  });
  (ListAuditLogsService as jest.Mock).mockResolvedValue({ records: [] });
  (startSetup as jest.Mock).mockResolvedValue({ uri: "fictional-uri" });
  (confirmSetup as jest.Mock).mockResolvedValue([]);
  (newRecoveryCodes as jest.Mock).mockResolvedValue([]);
});

describe.each(operations)("$method $path current security actor", operation => {
  it("rejects a transferred actor before any security read or write", async () => {
    const token = bearer();
    actor.companyId = 202;
    expect((await call(operation, token)).status).toBe(403);
    expectNoSensitiveWork();
  });

  it("rejects an actor deleted after token issuance", async () => {
    actor = null;
    expect((await call(operation)).status).toBe(403);
    expectNoSensitiveWork();
  });

  it("rejects a profile changed since token issuance", async () => {
    actor.profile = "user";
    expect((await call(operation)).status).toBe(403);
    expectNoSensitiveWork();
  });

  it("rejects a super privilege removed since token issuance", async () => {
    expect((await call(operation, bearer({ super: true }))).status).toBe(403);
    expectNoSensitiveWork();
  });

  it("allows the matching current actor", async () => {
    expect((await call(operation)).status).toBe(200);
  });
});

it.each(operations.filter(operation => operation.administrative))(
  "$method $path refuses a current ordinary user",
  async operation => {
    actor.profile = "user";
    expect((await call(operation, bearer({ profile: "user" }))).status).toBe(
      403
    );
    expectNoSensitiveWork();
  }
);

it.each(operations.filter(operation => !operation.administrative))(
  "$method $path permits ordinary users to manage their own security",
  async operation => {
    actor.profile = "user";
    expect((await call(operation, bearer({ profile: "user" }))).status).toBe(
      200
    );
  }
);

it("keeps a current super administrator's recovery exemption", async () => {
  actor.super = true;
  const response = await call(operations[7], bearer({ super: true }));
  expect(response.status).toBe(200);
  expect(saveAllowlist).toHaveBeenCalledWith(
    expect.objectContaining({ companyId: 101, isSuper: true })
  );
});

it("does not reset the actor's own second factor through the admin route", async () => {
  const response = await request(app)
    .delete("/users/11/2fa")
    .set("Authorization", `Bearer ${bearer()}`);
  expect(response.status).toBe(403);
  expectNoSensitiveWork();
});

it("does not reset a foreign company's second factor", async () => {
  target.companyId = 202;
  expect((await call(operations[5])).status).toBe(404);
  expectNoSensitiveWork();
});

it("requires a current super administrator to reset a super target", async () => {
  target.super = true;
  expect((await call(operations[5])).status).toBe(403);
  expectNoSensitiveWork();
  actor.super = true;
  expect((await call(operations[5], bearer({ super: true }))).status).toBe(200);
  expect(resetTwoFactor).toHaveBeenCalledWith(
    expect.objectContaining({ id: 42 })
  );
});

it("rejects missing and forged tokens before loading an actor", async () => {
  expect((await call(operations[7], false)).status).toBe(401);
  expect((await call(operations[7], "fictional-invalid-token")).status).toBe(
    403
  );
  expect(User.findOne).not.toHaveBeenCalled();
  expect(User.findByPk).not.toHaveBeenCalled();
  expectNoSensitiveWork();
});
