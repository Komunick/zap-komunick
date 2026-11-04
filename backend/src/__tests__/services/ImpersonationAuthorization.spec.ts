import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import authRoutes from "../../routes/authRoutes";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import * as tokens from "../../helpers/CreateTokens";
import * as cookies from "../../helpers/SendRefreshToken";
import * as serialization from "../../helpers/SerializeUser";
import { getIO } from "../../libs/socket";
import RecordAuditService, {
  auditRequest
} from "../../services/AuditServices/RecordAuditService";
import { checkSignInIp } from "../../services/SecurityServices/IpAllowlistService";
import AuthUserService from "../../services/UserServices/AuthUserService";
import { checkSecondFactor } from "../../services/SecurityServices/TwoFactorService";

// Real router, JWT verification, controllers, refresh service, token helpers,
// serialization and cookie transport. Only persistence/external I/O is doubled.
jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: {
    secret: "fictional-impersonation-access-key",
    refreshSecret: "fictional-impersonation-refresh-key",
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
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Translation", () => ({ findAll: jest.fn() }));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../services/UserServices/AuthUserService", () => jest.fn());
jest.mock("../../services/AuthServices/FindUserFromToken", () => jest.fn());
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  __esModule: true,
  default: jest.fn(),
  auditRequest: jest.fn(),
  requestIp: jest.fn(() => "192.0.2.10")
}));
jest.mock("../../services/SecurityServices/IpAllowlistService", () => ({
  checkSignInIp: jest.fn()
}));
jest.mock("../../services/SecurityServices/TwoFactorService", () => ({
  checkSecondFactor: jest.fn(),
  consumeChallenge: jest.fn(),
  readChallenge: jest.fn()
}));

interface Actor {
  id: number;
  companyId: number;
  name: string;
  email: string;
  profile: string;
  super: boolean;
  tokenVersion: number;
  twoFactorEnabled?: boolean;
  accessHours?: { weekdays: number[]; start: string; end: string } | null;
}
interface Pair {
  access: string;
  refresh?: string;
}
interface PairOptions {
  access?: Record<string, unknown>;
  refresh?: Record<string, unknown>;
  accessLifetime?: number;
  refreshLifetime?: number;
  accessKey?: string;
  refreshKey?: string;
}
interface Read {
  id?: unknown;
  where?: Record<string, unknown>;
  include?: unknown;
  attributes?: string[];
}

const fixture: Record<string, Actor> = {
  userA: {
    id: 101,
    companyId: 10,
    name: "QA User Alfa",
    email: "user@alfa.example.test",
    profile: "user",
    super: false,
    tokenVersion: 1
  },
  adminA: {
    id: 102,
    companyId: 10,
    name: "QA Admin Alfa",
    email: "admin@alfa.example.test",
    profile: "admin",
    super: false,
    tokenVersion: 2
  },
  superA: {
    id: 103,
    companyId: 10,
    name: "QA Super Alfa",
    email: "super@alfa.example.test",
    profile: "admin",
    super: true,
    tokenVersion: 3
  },
  adminB: {
    id: 201,
    companyId: 20,
    name: "QA TARGET B PRIVATE CANARY",
    email: "admin@beta.example.test",
    profile: "admin",
    super: false,
    tokenVersion: 7,
    twoFactorEnabled: true
  },
  userB: {
    id: 202,
    companyId: 20,
    name: "QA User Beta",
    email: "user@beta.example.test",
    profile: "user",
    super: false,
    tokenVersion: 4
  }
};
const originMetadata = {
  impersonated: true,
  originalUserId: fixture.superA.id,
  originalCompanyId: fixture.superA.companyId,
  originalTokenVersion: fixture.superA.tokenVersion
};
const accessKey = "fictional-impersonation-access-key";
const refreshKey = "fictional-impersonation-refresh-key";
let rows: Actor[];
let reads: Read[];
const emit = jest.fn();
const to = jest.fn(() => ({ emit }));
const accessSpy = jest.spyOn(tokens, "createAccessToken");
const refreshSpy = jest.spyOn(tokens, "createRefreshToken");
const sendCookieSpy = jest.spyOn(cookies, "SendRefreshToken");
const serializeSpy = jest.spyOn(serialization, "SerializeUser");
const originalBackendUrl = process.env.BACKEND_URL;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

function pair(
  actor = "superA",
  options: PairOptions = {},
  metadata = {}
): Pair {
  const row = fixture[actor];
  return {
    access: sign(
      {
        id: row.id,
        companyId: row.companyId,
        profile: row.profile,
        super: row.super,
        impersonated: false,
        ...metadata,
        ...options.access
      },
      options.accessKey || accessKey,
      { expiresIn: options.accessLifetime ?? 300 }
    ),
    refresh: sign(
      {
        id: row.id,
        companyId: row.companyId,
        tokenVersion: row.tokenVersion,
        impersonated: false,
        ...metadata,
        ...options.refresh
      },
      options.refreshKey || refreshKey,
      { expiresIn: options.refreshLifetime ?? 300 }
    )
  };
}
const delegated = (options: PairOptions = {}) =>
  pair("adminB", options, originMetadata);
function call(
  route: "start" | "back" | "refresh",
  credentials: Pair,
  company = "20"
) {
  const pending =
    route === "start"
      ? request(app).get(`/auth/impersonate/${company}`)
      : request(app).post(
          route === "back" ? "/auth/impersonate/back" : "/auth/refresh_token"
        );
  if (credentials.access)
    pending.set("Authorization", `Bearer ${credentials.access}`);
  if (credentials.refresh) pending.set("Cookie", `jrt=${credentials.refresh}`);
  return pending;
}
function hydrate(row: Actor, options: Read = {}) {
  const selected = options.attributes
    ? Object.fromEntries(
        options.attributes.map(key => [key, row[key as keyof Actor]])
      )
    : { ...row };
  return {
    ...selected,
    queues: [],
    company: {
      id: row.companyId,
      name: row.companyId === 10 ? "QA Alfa" : "QA Beta",
      dueDate: "2093-03-14",
      settings: []
    }
  };
}
function noIssuance(response, clearAllowed = false, clearRequired = false) {
  expect(accessSpy).not.toHaveBeenCalled();
  expect(refreshSpy).not.toHaveBeenCalled();
  expect(sendCookieSpy).not.toHaveBeenCalled();
  expect(serializeSpy).not.toHaveBeenCalled();
  expect(auditRequest).not.toHaveBeenCalled();
  expect(getIO).not.toHaveBeenCalled();
  expect(emit).not.toHaveBeenCalled();
  expect(response.body).not.toHaveProperty("token");
  expect(response.body).not.toHaveProperty("user");
  const setCookies: string[] = response.headers["set-cookie"] || [];
  if (!clearAllowed) expect(setCookies).toHaveLength(0);
  else setCookies.forEach(cookie => expect(cookie).toMatch(/^jrt=;/));
  if (clearRequired)
    expect(setCookies.some(cookie => cookie.startsWith("jrt=;"))).toBe(true);
}
function noTargetRead() {
  expect(
    reads.filter(
      read =>
        Number(read.id) === fixture.adminB.id ||
        Number(read.where?.companyId) === 20 ||
        (read.where?.profile === "admin" && read.where?.id === undefined)
    )
  ).toEqual([]);
}
function outputClaims(response) {
  const cookie = (response.headers["set-cookie"] as string[]).find(value =>
    value.startsWith("jrt=")
  );
  expect(cookie).toBeDefined();
  return {
    access: verify(response.body.token, accessKey) as JwtPayload,
    refresh: verify(cookie.split(";", 1)[0].slice(4), refreshKey) as JwtPayload
  };
}

beforeAll(() => {
  process.env.BACKEND_URL = "http://superchat.example.test";
});
afterAll(() => {
  if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = originalBackendUrl;
});
beforeEach(() => {
  jest.clearAllMocks();
  rows = Object.values(fixture).map(row => ({ ...row }));
  reads = [];
  (checkSignInIp as jest.Mock).mockResolvedValue(true);
  (getIO as jest.Mock).mockReturnValue({ to });
  (User.findOne as jest.Mock).mockImplementation(async (options: Read) => {
    reads.push(options);
    const row = rows.find(item =>
      Object.entries(options.where).every(
        ([key, value]) => String(item[key as keyof Actor]) === String(value)
      )
    );
    return row ? hydrate(row, options) : null;
  });
  (User.findByPk as jest.Mock).mockImplementation(async (id, options = {}) => {
    reads.push({ id, ...options });
    const row = rows.find(item => item.id === Number(id));
    return row ? hydrate(row, options) : null;
  });
});

describe("starting an impersonated session", () => {
  it.each(["userA", "adminA"])(
    "refuses current non-super %s before reading the target",
    async actor => {
      const response = await call("start", pair(actor));
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
      noIssuance(response);
      noTargetRead();
      expect(RecordAuditService).not.toHaveBeenCalled();
    }
  );
  it.each(["deleted", "moved", "profile changed", "super revoked"])(
    "refuses a current Super whose account was %s",
    async state => {
      const origin = rows.find(row => row.id === fixture.superA.id);
      if (state === "deleted") rows = rows.filter(row => row !== origin);
      if (state === "moved") origin.companyId = 30;
      if (state === "profile changed") origin.profile = "user";
      if (state === "super revoked") origin.super = false;
      const response = await call("start", pair());
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
      noIssuance(response);
      noTargetRead();
    }
  );
  it("does not trust a forged Super claim on an administrator token", async () => {
    const response = await call(
      "start",
      pair("adminA", { access: { super: true } })
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
    noIssuance(response);
    noTargetRead();
  });
  it("requires a refresh cookie", async () => {
    const response = await call("start", { access: pair().access });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
    noIssuance(response);
    noTargetRead();
  });
  it.each([
    { name: "expired cookie", options: { refreshLifetime: -1 } },
    {
      name: "wrong refresh signature",
      options: { refreshKey: "fictional-wrong-refresh-key" }
    },
    { name: "cookie user differs", options: { refresh: { id: 102 } } },
    { name: "cookie company differs", options: { refresh: { companyId: 20 } } },
    {
      name: "cookie version differs",
      options: { refresh: { tokenVersion: 99 } }
    },
    {
      name: "cookie version missing",
      options: { refresh: { tokenVersion: undefined } }
    },
    {
      name: "mixed impersonation flag",
      options: { refresh: { impersonated: true, ...originMetadata } }
    }
  ])("rejects $name before target data or issuance", async ({ options }) => {
    const response = await call("start", pair("superA", options));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
    noIssuance(response);
    noTargetRead();
  });
  it.each(["0", "-20", "NaN", "20.5", "020", "2e1", "9007199254740992"])(
    "rejects malformed target %s before loading it",
    async target => {
      const response = await call("start", pair(), target);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "ERR_BAD_REQUEST" });
      noIssuance(response);
      noTargetRead();
    }
  );
  it("returns 404 when the selected company has no administrator", async () => {
    rows = rows.filter(row => row.id !== fixture.adminB.id);
    const response = await call("start", pair());
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "ERR_NO_USER_FOUND" });
    noIssuance(response);
  });
  it("refuses nested impersonation without issuing another session", async () => {
    const response = await call("start", delegated(), "10");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "ERR_ALREADY_IMPERSONATING" });
    noIssuance(response);
  });
  it("checks target IP policy before generating session tokens", async () => {
    (checkSignInIp as jest.Mock).mockImplementation(
      async companyId => companyId !== 20
    );
    const response = await call("start", pair());
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "ERR_IP_NOT_ALLOWED" });
    noIssuance(response);
  });
  it("issues a bounded delegated session for a current Super without asking target credentials", async () => {
    const response = await call("start", pair());
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(fixture.adminB.id);
    const claims = outputClaims(response);
    [claims.access, claims.refresh].forEach(value => {
      expect(value).toMatchObject({
        id: fixture.adminB.id,
        companyId: 20,
        ...originMetadata
      });
    });
    expect(claims.refresh.tokenVersion).toBe(fixture.adminB.tokenVersion);
    expect(accessSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(sendCookieSpy).toHaveBeenCalledTimes(1);
    expect(serializeSpy).toHaveBeenCalledTimes(1);
    expect(AuthUserService).not.toHaveBeenCalled();
    expect(checkSecondFactor).not.toHaveBeenCalled();
    expect(auditRequest).toHaveBeenCalledTimes(1);
    const [, action, entity, entityId, details] = (auditRequest as jest.Mock)
      .mock.calls[0];
    expect([action, entity, Number(entityId), details]).toEqual([
      "auth.impersonate",
      "company",
      20,
      { asUserId: fixture.adminB.id }
    ]);
    expect(to).toHaveBeenCalledWith(`user-${fixture.adminB.id}`);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});

describe("returning from impersonation", () => {
  it("restores the current original Super and removes delegation metadata", async () => {
    const response = await call("back", delegated());
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(fixture.superA.id);
    const claims = outputClaims(response);
    [claims.access, claims.refresh].forEach(value => {
      expect(value).toMatchObject({
        id: fixture.superA.id,
        companyId: 10,
        impersonated: false
      });
      ["originalUserId", "originalCompanyId", "originalTokenVersion"].forEach(
        key => expect(value).not.toHaveProperty(key)
      );
    });
    expect(checkSignInIp).toHaveBeenCalledWith(
      10,
      "192.0.2.10",
      expect.objectContaining({ super: true })
    );
  });
  it("returns using the original account's current profile while Super remains active", async () => {
    rows.find(row => row.id === fixture.superA.id).profile = "user";
    const response = await call("back", delegated());
    expect(response.status).toBe(200);
    expect(response.body.user.profile).toBe("user");
    expect(outputClaims(response).access.profile).toBe("user");
  });
  it.each(["userA", "adminA", "superA"])(
    "does not escalate an ordinary %s session through the return endpoint",
    async actor => {
      const response = await call("back", pair(actor));
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "ERR_NOT_IMPERSONATING" });
      noIssuance(response);
    }
  );
  it("requires a refresh cookie", async () => {
    const response = await call("back", { access: delegated().access });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
    noIssuance(response, true);
  });
  it.each([
    { name: "expired cookie", options: { refreshLifetime: -1 } },
    {
      name: "wrong refresh signature",
      options: { refreshKey: "fictional-wrong-key" }
    },
    { name: "different target identity", options: { refresh: { id: 202 } } },
    {
      name: "different target company",
      options: { refresh: { companyId: 10 } }
    },
    { name: "different flags", options: { access: { impersonated: false } } },
    {
      name: "different original user",
      options: { access: { originalUserId: 102 } }
    },
    {
      name: "different original company",
      options: { access: { originalCompanyId: 20 } }
    },
    {
      name: "different original version",
      options: { access: { originalTokenVersion: 99 } }
    },
    {
      name: "legacy pair without original version",
      options: {
        access: { originalTokenVersion: undefined },
        refresh: { originalTokenVersion: undefined }
      }
    },
    {
      name: "invalid negative original version",
      options: {
        access: { originalTokenVersion: -1 },
        refresh: { originalTokenVersion: -1 }
      }
    }
  ])("refuses $name without restoring privileges", async ({ options }) => {
    const response = await call("back", delegated(options));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
    noIssuance(response, true);
  });
});

describe.each(["start", "back"] as const)(
  "%s preserves shared access-token validation",
  operation => {
    it.each([
      { accessLifetime: -1 },
      { accessKey: "fictional-wrong-access-key" }
    ])(
      "rejects an expired or wrongly signed bearer before side effects",
      async options => {
        const credentials =
          operation === "start" ? pair("superA", options) : delegated(options);
        const response = await call(operation, credentials);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
        noIssuance(response);
        if (operation === "start") noTargetRead();
      }
    );
    it("requires a bearer as well as the refresh cookie", async () => {
      const credentials = operation === "start" ? pair() : delegated();
      const response = await call(operation, {
        access: "",
        refresh: credentials.refresh
      });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
      noIssuance(response);
      if (operation === "start") noTargetRead();
    });
  }
);

const revokedStates = [
  { name: "target deleted", actor: "adminB", mutation: "deleted" },
  { name: "target moved", actor: "adminB", mutation: "moved" },
  {
    name: "target token version revoked",
    actor: "adminB",
    mutation: "version"
  },
  { name: "origin deleted", actor: "superA", mutation: "deleted" },
  { name: "origin moved", actor: "superA", mutation: "moved" },
  {
    name: "origin token version revoked",
    actor: "superA",
    mutation: "version"
  },
  { name: "origin Super privilege revoked", actor: "superA", mutation: "super" }
];
describe.each(["back", "refresh"] as const)(
  "delegated %s revalidates both accounts",
  operation => {
    it.each(revokedStates)(
      "refuses $name before issuing tokens",
      async ({ actor, mutation }) => {
        const current = rows.find(row => row.id === fixture[actor].id);
        if (mutation === "deleted") rows = rows.filter(row => row !== current);
        if (mutation === "moved") current.companyId = 30;
        if (mutation === "version") current.tokenVersion += 1;
        if (mutation === "super") current.super = false;
        const response = await call(operation, delegated());
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
        noIssuance(response, true, operation === "refresh");
      }
    );
  }
);

describe("refreshing delegated and normal sessions", () => {
  it.each(["back", "refresh"] as const)(
    "accepts version zero on both current accounts during %s",
    async operation => {
      rows.find(row => row.id === fixture.superA.id).tokenVersion = 0;
      rows.find(row => row.id === fixture.adminB.id).tokenVersion = 0;
      const response = await call(
        operation,
        delegated({
          access: { originalTokenVersion: 0 },
          refresh: { tokenVersion: 0, originalTokenVersion: 0 }
        })
      );
      expect(response.status).toBe(200);
      if (operation === "refresh") {
        const claims = outputClaims(response);
        expect(claims.access.originalTokenVersion).toBe(0);
        expect(claims.refresh.originalTokenVersion).toBe(0);
        expect(claims.refresh.tokenVersion).toBe(0);
      }
    }
  );
  it("requires a refresh cookie without creating a session", async () => {
    const response = await call("refresh", { access: pair().access });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
    noIssuance(response, true);
  });
  it.each([
    { refreshLifetime: -1 },
    { refreshKey: "fictional-wrong-refresh-key" }
  ])("rejects an expired or wrongly signed refresh cookie", async options => {
    const response = await call("refresh", delegated(options));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
    noIssuance(response, true, true);
  });
  it("rejects delegated refresh after the target administrator profile was revoked", async () => {
    const target = rows.find(row => row.id === fixture.adminB.id);
    target.profile = "user";
    target.accessHours = { weekdays: [], start: "01:00", end: "02:00" };
    const response = await call("refresh", delegated());
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
    noIssuance(response, true, true);
  });
  it("preserves delegated refresh for the target administrator with configured access hours", async () => {
    rows.find(row => row.id === fixture.adminB.id).accessHours = {
      weekdays: [],
      start: "01:00",
      end: "02:00"
    };
    const response = await call("refresh", delegated());
    expect(response.status).toBe(200);
    expect(response.body.user.profile).toBe("admin");
  });
  it("reissues the same bounded delegation metadata on both tokens", async () => {
    const response = await call("refresh", delegated());
    expect(response.status).toBe(200);
    const claims = outputClaims(response);
    [claims.access, claims.refresh].forEach(value =>
      expect(value).toMatchObject({
        id: fixture.adminB.id,
        companyId: 20,
        ...originMetadata
      })
    );
    expect(claims.refresh.tokenVersion).toBe(fixture.adminB.tokenVersion);
  });
  it.each([
    { name: "legacy cookie", refresh: { originalTokenVersion: undefined } },
    { name: "missing original user", refresh: { originalUserId: undefined } },
    {
      name: "missing original company",
      refresh: { originalCompanyId: undefined }
    },
    {
      name: "negative original version",
      refresh: { originalTokenVersion: -1 }
    },
    {
      name: "non-integer original version",
      refresh: { originalTokenVersion: 3.5 }
    },
    { name: "wrong target version", refresh: { tokenVersion: 99 } },
    { name: "different target company", refresh: { companyId: 10 } }
  ])("rejects $name and clears the refresh cookie", async ({ refresh }) => {
    const response = await call("refresh", delegated({ refresh }));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
    noIssuance(response, true, true);
  });
  it("checks target IP policy before token creation", async () => {
    (checkSignInIp as jest.Mock).mockImplementation(
      async companyId => companyId !== 20
    );
    const credentials = delegated();
    const response = await call("refresh", credentials).set(
      "User-Agent",
      "FICTITIOUS-IMPERSONATION-CLIENT"
    );
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "ERR_IP_NOT_ALLOWED" });
    expect(RecordAuditService).toHaveBeenCalledTimes(1);
    expect(RecordAuditService).toHaveBeenCalledWith({
      companyId: 20,
      userId: fixture.adminB.id,
      action: "auth.ip_blocked",
      entity: "user",
      entityId: fixture.adminB.id,
      details: { on: "refresh" },
      ip: "192.0.2.10",
      userAgent: "FICTITIOUS-IMPERSONATION-CLIENT"
    });
    const audit = JSON.stringify((RecordAuditService as jest.Mock).mock.calls);
    expect(audit).not.toContain(credentials.access);
    expect(audit).not.toContain(credentials.refresh);
    noIssuance(response, true, true);
  });
  it.each(["userA", "adminA", "superA"])(
    "preserves normal refresh for %s",
    async actor => {
      const response = await call("refresh", pair(actor));
      expect(response.status).toBe(200);
      Object.values(outputClaims(response)).forEach(value => {
        expect(value).toMatchObject({
          id: fixture[actor].id,
          companyId: fixture[actor].companyId,
          impersonated: false
        });
      });
    }
  );
  it("discards origin metadata carried by a non-impersonated cookie", async () => {
    const response = await call(
      "refresh",
      pair("userA", {
        refresh: {
          originalUserId: 103,
          originalCompanyId: 10,
          originalTokenVersion: 3
        }
      })
    );
    expect(response.status).toBe(200);
    Object.values(outputClaims(response)).forEach(value => {
      expect(value.impersonated).toBe(false);
      ["originalUserId", "originalCompanyId", "originalTokenVersion"].forEach(
        key => expect(value).not.toHaveProperty(key)
      );
    });
  });
  it("keeps normal access-hour enforcement", async () => {
    rows.find(row => row.id === fixture.userA.id).accessHours = {
      weekdays: [],
      start: "01:00",
      end: "02:00"
    };
    const response = await call("refresh", pair("userA"));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "ERR_OUT_OF_ACCESS_HOURS" });
    expect(sendCookieSpy).not.toHaveBeenCalled();
    expect(response.body).not.toHaveProperty("token");
  });
});
