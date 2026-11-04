import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import sequelize from "../../database";
import User from "../../models/User";
import Company from "../../models/Company";
import CompanyCredential from "../../models/CompanyCredential";
import Setting from "../../models/Setting";
import routes from "../../routes/credentialRoutes";
import AppError from "../../errors/AppError";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";

jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: "fictional-credential-route-key-not-a-real-secret" }
}));
jest.mock("../../database", () => ({ transaction: jest.fn() }));
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Company", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/CompanyCredential", () => {
  const model = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    unscoped: jest.fn()
  };
  model.unscoped.mockReturnValue(model);
  return model;
});
jest.mock("../../models/Setting", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  destroy: jest.fn()
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn()
}));

const app = express();
app.use(express.json());
app.use(routes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

type Method = "get" | "put" | "delete" | "post";
interface Operation {
  method: Method;
  path: string;
  write: boolean;
}
const operations: Operation[] = [
  { method: "get", path: "/credentials", write: false },
  { method: "get", path: "/credentials/openAiKey", write: false },
  { method: "put", path: "/credentials/openAiKey", write: true },
  { method: "delete", path: "/credentials/openAiKey", write: true },
  { method: "post", path: "/credentials/migrate", write: true }
];
const companyA = 101,
  companyB = 202,
  actorId = 11;
const legacyA = "fictional-A-credential-canary",
  legacyB = "fictional-B-credential-canary",
  replacement = "fictional-replacement-not-a-provider-key";
const bearer = () =>
  sign(
    { id: actorId, companyId: companyA, profile: "admin", super: false },
    "fictional-credential-route-key-not-a-real-secret",
    { expiresIn: "5m" }
  );
const rowKey = (companyId: number, key: string) => `${companyId}:${key}`;

let actor: { id: number; companyId: number; profile: string } | null;
let onCompanyLock: (() => void) | undefined;
let transactionId: number;
interface FakeTransaction {
  id: number;
  LOCK: { UPDATE: string; SHARE: string };
}
interface CredentialFields {
  companyId: number;
  key: string;
  encryptedValue: string;
  keyId: string;
}
interface QueryOptions {
  transaction?: FakeTransaction;
  lock?: string;
  where?: { id?: number; companyId?: number; key?: unknown };
  defaults?: CredentialFields;
  raw?: boolean;
}
interface StoredCredential extends CredentialFields {
  update: (
    next: Partial<CredentialFields>,
    options: QueryOptions
  ) => Promise<void>;
}
let transactions: FakeTransaction[];
let trace: { kind: string; options?: QueryOptions }[];
let encrypted: Map<string, StoredCredential>;
let legacy: Map<string, string>;

const snapshot = () =>
  JSON.stringify({ encrypted: [...encrypted], legacy: [...legacy] });
const record = (kind: string, options?: QueryOptions) => {
  trace.push({ kind, options });
};
const credentialRows = (companyId: number) =>
  [...encrypted.values()].filter(row => row.companyId === companyId);
const storedRow = (values: CredentialFields) => {
  const row = {
    ...values,
    update: async (next: Partial<CredentialFields>, options: QueryOptions) => {
      record("vault-write", options);
      Object.assign(row, next);
    }
  };
  encrypted.set(rowKey(values.companyId, values.key), row);
  return row;
};
const call = (operation: Operation, token: string | false = bearer()) => {
  const pending = request(app)[operation.method](operation.path);
  if (token) pending.set("Authorization", `Bearer ${token}`);
  return pending.send(
    operation.method === "put" ? { value: replacement } : undefined
  );
};
const expectUntouched = (before: string) => {
  expect(snapshot()).toBe(before);
  expect(trace.filter(entry => entry.kind.startsWith("vault"))).toEqual([]);
  expect(auditRequest).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 17).toString("base64");
  delete process.env.CREDENTIALS_PREVIOUS_MASTER_KEY;
  actor = { id: actorId, companyId: companyA, profile: "admin" };
  onCompanyLock = undefined;
  transactionId = 0;
  transactions = [];
  trace = [];
  encrypted = new Map();
  legacy = new Map([
    [rowKey(companyA, "openAiKey"), legacyA],
    [rowKey(companyB, "openAiKey"), legacyB]
  ]);
  (User.findByPk as jest.Mock).mockImplementation(async id => {
    record("actor-unlocked");
    return actor?.id === Number(id) ? { ...actor } : null;
  });
  (User.findOne as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("actor-lock", options);
      const where = options.where;
      return actor?.id === Number(where.id) &&
        actor.companyId === where.companyId
        ? { ...actor }
        : null;
    }
  );
  (Company.findByPk as jest.Mock).mockImplementation(
    async (id, options: QueryOptions) => {
      record("company-lock", options);
      const action = onCompanyLock;
      onCompanyLock = undefined;
      action?.();
      return [companyA, companyB].includes(Number(id))
        ? { id: Number(id) }
        : null;
    }
  );
  (sequelize.transaction as jest.Mock).mockImplementation(async work => {
    const transaction = {
      id: ++transactionId,
      LOCK: { UPDATE: "UPDATE", SHARE: "SHARE" }
    };
    transactions.push(transaction);
    record("begin");
    try {
      const result = await work(transaction);
      record("commit");
      return result;
    } catch (error) {
      record("rollback");
      throw error;
    }
  });
  (CompanyCredential.findAll as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("vault-read", options);
      return credentialRows(options.where.companyId);
    }
  );
  (CompanyCredential.findOrCreate as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("vault-write", options);
      const key = rowKey(options.where.companyId, String(options.where.key));
      const found = encrypted.get(key);
      return [found || storedRow(options.defaults), !found];
    }
  );
  (CompanyCredential.create as jest.Mock).mockImplementation(
    async (values: CredentialFields, options: QueryOptions) => {
      record("vault-write", options);
      return storedRow(values);
    }
  );
  (CompanyCredential.destroy as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("vault-write", options);
      return Number(
        encrypted.delete(
          rowKey(options.where.companyId, String(options.where.key))
        )
      );
    }
  );
  (Setting.findAll as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("vault-read", options);
      return [...legacy]
        .filter(([key]) => key.startsWith(`${options.where.companyId}:`))
        .map(([key, value]) => ({
          key: key.split(":")[1],
          ...(options.raw ? { configured: !!value } : { value })
        }));
    }
  );
  (Setting.destroy as jest.Mock).mockImplementation(
    async (options: QueryOptions) => {
      record("vault-write", options);
      const keys = [...legacy.keys()].filter(key =>
        typeof options.where.key === "string"
          ? key === rowKey(options.where.companyId, options.where.key)
          : key.startsWith(`${options.where.companyId}:`)
      );
      keys.forEach(key => legacy.delete(key));
      return keys.length;
    }
  );
});

describe.each(operations)(
  "$method $path administrative boundary",
  operation => {
    it("rejects a transferred administrator before reading or mutating the vault", async () => {
      const oldToken = bearer();
      actor.companyId = companyB;
      const before = snapshot();
      const response = await call(operation, oldToken);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
      expectUntouched(before);
    });

    it("rejects an administrator removed after token issuance", async () => {
      const oldToken = bearer();
      actor = null;
      const before = snapshot();
      const response = await call(operation, oldToken);
      expect(response.status).toBe(403);
      expectUntouched(before);
    });

    it("rejects an administrator whose current profile was downgraded", async () => {
      const oldToken = bearer();
      actor.profile = "user";
      const before = snapshot();
      const response = await call(operation, oldToken);
      expect(response.status).toBe(403);
      expectUntouched(before);
    });

    it("allows the current administrator without exposing secrets or changing B", async () => {
      const response = await call(operation);
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain(legacyA);
      expect(JSON.stringify(response.body)).not.toContain(replacement);
      expect(JSON.stringify(response.body)).not.toContain("encryptedValue");
      expect(legacy.get(rowKey(companyB, "openAiKey"))).toBe(legacyB);
      expect(credentialRows(companyB)).toEqual([]);
      if (operation.method === "delete")
        expect(legacy.has(rowKey(companyA, "openAiKey"))).toBe(false);
      if (operation.method === "put" || operation.method === "post") {
        expect(credentialRows(companyA)).toHaveLength(1);
        expect(legacy.has(rowKey(companyA, "openAiKey"))).toBe(false);
      }
      expect(auditRequest).toHaveBeenCalledTimes(operation.write ? 1 : 0);
    });

    it("holds company then actor in the same transaction through all storage IO", async () => {
      const response = await call(operation);
      expect(response.status).toBe(200);
      expect(transactions).toHaveLength(1);
      const [transaction] = transactions;
      const companyLock = trace.findIndex(
        entry => entry.kind === "company-lock"
      );
      const actorLock = trace.findIndex(entry => entry.kind === "actor-lock");
      const vault = trace.filter(entry => entry.kind.startsWith("vault"));
      expect(companyLock).toBeGreaterThanOrEqual(0);
      expect(actorLock).toBeGreaterThan(companyLock);
      expect(vault.length).toBeGreaterThan(0);
      expect(trace[actorLock].options).toEqual(
        expect.objectContaining({ transaction, lock: "SHARE" })
      );
      expect(trace[companyLock].options).toEqual(
        expect.objectContaining({
          transaction,
          lock: operation.write ? "UPDATE" : "SHARE"
        })
      );
      expect(
        vault.every(entry => entry.options.transaction === transaction)
      ).toBe(true);
      expect(trace[trace.length - 1].kind).toBe("commit");
    });
  }
);

it.each(operations.filter(operation => operation.write))(
  "$method rechecks a transfer completed while waiting for the company lock",
  async operation => {
    onCompanyLock = () => {
      actor.companyId = companyB;
    };
    const before = snapshot();
    const response = await call(operation);
    expect(response.status).toBe(403);
    expectUntouched(before);
  }
);

it("rejects missing or forged access credentials before consulting the vault", async () => {
  const before = snapshot();
  expect((await call(operations[0], false)).status).toBe(401);
  expect((await call(operations[0], "fictional-invalid-token")).status).toBe(
    403
  );
  expectUntouched(before);
});

it("does not accept a foreign company supplied in query or body", async () => {
  const response = await request(app)
    .put(`/credentials/openAiKey?companyId=${companyB}`)
    .set("Authorization", `Bearer ${bearer()}`)
    .send({ companyId: companyB, value: replacement });
  expect(response.status).toBe(200);
  expect(legacy.get(rowKey(companyB, "openAiKey"))).toBe(legacyB);
  expect(credentialRows(companyB)).toEqual([]);
  expect(credentialRows(companyA)).toHaveLength(1);
});
