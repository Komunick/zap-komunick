import "express-async-errors";
import express from "express";
import request, { Response as TestResponse, Test } from "supertest";
import multer from "multer";
import { sign } from "jsonwebtoken";
import { Op } from "sequelize";
import fs from "fs";
import os from "os";
import path from "path";
import QueueOption from "../../models/QueueOption";

// The same HTTP spec runs against the candidate and 20bb baseline. Only ORM,
// socket emission and the older shared upload helper are doubles; routers,
// JWT verification, controllers, services, Multer and disk writes are real.
type MockRow = {
  id: number;
  companyId?: number;
  profile?: string;
  super?: boolean;
  queueId?: number | null;
  parentId?: number | null;
  mediaPath?: string | null;
  mediaName?: string | null;
  topParentQueueId?: number;
  topParentQueue?: MockRow;
  update?: jest.Mock;
  reload?: jest.Mock;
  save?: jest.Mock;
  destroy?: jest.Mock;
  toJSON?: () => Record<string, unknown>;
  [key: string]: unknown;
};
type MockWhere = Record<string | symbol, unknown>;
type MockQuery = { where?: MockWhere };
let mockUsers: MockRow[], mockQueues: MockRow[], mockOptions: MockRow[];
let mockStorageRoot: string;
const mockSecret = "fictitious-queue-administration-unit-signing-key";
const mockEmit = jest.fn();

function mockMatches(row: MockRow, where: MockWhere = {}): boolean {
  return Reflect.ownKeys(where).every(key => {
    const expected = where[key];
    if (expected && typeof expected === "object") {
      const condition = expected as Record<symbol, unknown>;
      if (Array.isArray(condition[Op.in]))
        return (condition[Op.in] as unknown[])
          .map(String)
          .includes(String(Reflect.get(row, key)));
      if (Op.ne in condition)
        return String(Reflect.get(row, key)) !== String(condition[Op.ne]);
    }
    return expected === null
      ? Reflect.get(row, key) == null
      : String(Reflect.get(row, key)) === String(expected);
  });
}

function mockRow(values: Partial<MockRow>, store: MockRow[]): MockRow {
  const row: MockRow = { id: 0, mediaPath: null, mediaName: null, ...values };
  row.update = jest.fn(async (fields: Record<string, unknown>) => {
    Object.assign(row, fields);
    return row;
  });
  row.reload = jest.fn(async () => row);
  row.save = jest.fn(async () => row);
  row.destroy = jest.fn(async () => {
    const index = store.indexOf(row);
    if (index >= 0) store.splice(index, 1);
  });
  row.toJSON = () =>
    Object.fromEntries(
      Object.entries(row).filter(([, value]) => typeof value !== "function")
    );
  return row;
}

jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: mockSecret }
}));
jest.mock("../../config/upload", () => {
  return {
    __esModule: true,
    default: {
      directory: mockStorageRoot,
      storage: multer.diskStorage({
        destination: mockStorageRoot,
        filename: (
          _req: express.Request,
          file: Express.Multer.File,
          done: (error: Error | null, name: string) => void
        ) =>
          done(
            null,
            `baseline-upload-${Date.now()}${path.extname(file.originalname)}`
          )
      })
    }
  };
});
jest.mock("../../helpers/GetPublicPath", () => ({
  getPublicPath: () => mockStorageRoot
}));
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: jest.fn(() => ({ emit: mockEmit })) })
}));
jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(
      async (query: MockQuery) =>
        mockUsers.find(row => mockMatches(row, query?.where)) || null
    ),
    findByPk: jest.fn(
      async (id: string | number) =>
        mockUsers.find(row => String(row.id) === String(id)) || null
    )
  }
}));
jest.mock("../../models/Queue", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(
      async (query: MockQuery) =>
        mockQueues.find(row => mockMatches(row, query?.where)) || null
    ),
    findByPk: jest.fn(
      async (id: string | number) =>
        mockQueues.find(row => String(row.id) === String(id)) || null
    ),
    findAll: jest.fn(async (query: MockQuery) =>
      mockQueues.filter(row => mockMatches(row, query?.where))
    ),
    count: jest.fn(
      async (query: MockQuery) =>
        mockQueues.filter(row => mockMatches(row, query?.where)).length
    ),
    create: jest.fn(async (data: Partial<MockRow>) => {
      const row = mockRow({ id: 900, ...data }, mockQueues);
      mockQueues.push(row);
      return row;
    })
  }
}));
jest.mock("../../models/Company", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => null) }
}));
jest.mock("../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../models/QueueOption", () => ({
  __esModule: true,
  default: {
    withTopParentQueue: (query: MockQuery) => query,
    findOne: jest.fn(
      async (query: MockQuery) =>
        mockOptions.find(row => mockMatches(row, query?.where)) || null
    ),
    findByPk: jest.fn(
      async (id: string | number) =>
        mockOptions.find(row => String(row.id) === String(id)) || null
    ),
    findAll: jest.fn(async (query: MockQuery) =>
      mockOptions.filter(row => mockMatches(row, query?.where))
    ),
    create: jest.fn(async (data: Partial<MockRow>) => {
      const row = mockRow(
        { id: 900, parentId: null, forwardQueueId: null, ...data },
        mockOptions
      );
      mockOptions.push(row);
      return row;
    })
  }
}));
jest.mock("../../helpers/saveMediaFile", () => ({
  __esModule: true,
  default: jest.fn(
    async (
      file: { filename: string; data: Uint8Array },
      options: { destination: number }
    ) => {
      const relative = `media/${options.destination}/baseline-fixture/${file.filename}`;
      const destination = path.join(mockStorageRoot, ...relative.split("/"));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.data);
      return relative;
    }
  )
}));

let app: express.Express, sandbox: string, originalCwd: string;
let writeStream: jest.SpyInstance;
const bytes = Buffer.from("FICTITIOUS QUEUE ATTACHMENT\n", "utf8");
const token = (id = 1) => {
  const actor = mockUsers.find(row => row.id === id);
  return sign(
    {
      id: actor.id,
      companyId: actor.companyId,
      profile: actor.profile,
      super: actor.super,
      username: "QA"
    },
    mockSecret,
    { expiresIn: "15m" }
  );
};
const auth = (builder: Test, id = 1) =>
  builder.set("Authorization", `Bearer ${token(id)}`);
const upload = (route: string, id = 1) =>
  auth(request(app).post(route), id).attach("file", bytes, "fixture.txt");
const error = (response: TestResponse, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(response.body.error).toBe(code);
};
const ids = (response: TestResponse) =>
  response.body
    .map((row: { id: number }) => row.id)
    .sort((a: number, b: number) => a - b);

beforeAll(async () => {
  originalCwd = process.cwd();
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "superchat-queue-auth-"));
  mockStorageRoot = path.join(sandbox, "public");
  fs.mkdirSync(mockStorageRoot);
  process.chdir(sandbox);
  app = express();
  app.use(express.json());
  app.use((await import("../../routes/queueRoutes")).default);
  app.use((await import("../../routes/queueOptionRoutes")).default);
  app.use(
    (
      err: Error & { statusCode?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) =>
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || "INTERNAL" })
  );
});

beforeEach(() => {
  expect(path.dirname(path.resolve(mockStorageRoot))).toBe(
    path.resolve(sandbox)
  );
  fs.rmSync(mockStorageRoot, { recursive: true, force: true });
  fs.mkdirSync(mockStorageRoot);
  mockUsers = [
    { id: 1, companyId: 1, profile: "admin", super: false },
    { id: 2, companyId: 1, profile: "user", super: false },
    { id: 3, companyId: 1, profile: "admin", super: true },
    { id: 4, companyId: 2, profile: "admin", super: false }
  ];
  mockQueues = [];
  mockOptions = [];
  [
    { id: 10, companyId: 1, name: "QA Alfa", color: "#112233" },
    { id: 11, companyId: 1, name: "QA Alfa Fiscal", color: "#445566" },
    { id: 20, companyId: 2, name: "QA Beta", color: "#778899" }
  ].forEach(values => mockQueues.push(mockRow(values, mockQueues)));
  [
    { id: 100, queueId: 10, parentId: null },
    { id: 101, queueId: null, parentId: 100 },
    { id: 102, queueId: 10, parentId: 100 },
    { id: 110, queueId: 11, parentId: null },
    { id: 200, queueId: 20, parentId: null },
    { id: 201, queueId: null, parentId: 200 }
  ].forEach(values =>
    mockOptions.push(
      mockRow(
        { title: "QA option", option: "1", forwardQueueId: null, ...values },
        mockOptions
      )
    )
  );
  mockOptions.forEach(row => {
    row.topParentQueueId = row.queueId || (row.parentId < 200 ? 10 : 20);
    row.topParentQueue = mockQueues.find(
      queue => queue.id === row.topParentQueueId
    );
  });
  writeStream = jest.spyOn(fs, "createWriteStream");
});
afterEach(() => writeStream.mockRestore());
afterAll(() => {
  process.chdir(originalCwd);
  expect(path.dirname(path.resolve(sandbox))).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(sandbox).startsWith("superchat-queue-auth-")).toBe(true);
  fs.rmSync(sandbox, { recursive: true, force: true });
});

test("own lists include legacy children and omit another office", async () => {
  const response = await auth(request(app).get("/queue-options"));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([100, 101, 102, 110]);
});
test("queue filter keeps the own legacy subtree", async () => {
  const response = await auth(request(app).get("/queue-options?queueId=10"));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([100, 101, 102]);
});
test("root and direct-child filters retain the approved hierarchy", async () => {
  const roots = await auth(request(app).get("/queue-options?parentId=-1"));
  expect(roots.status).toBe(200);
  expect(ids(roots)).toEqual([100, 110]);
  const children = await auth(request(app).get("/queue-options?parentId=100"));
  expect(children.status).toBe(200);
  expect(ids(children)).toEqual([101, 102]);
});
test("an authorized legacy child can be shown", async () => {
  const response = await auth(request(app).get("/queue-options/101"));
  expect(response.status).toBe(200);
  expect(response.body.id).toBe(101);
});
test.each([
  "/queue-options?queueId=20",
  "/queue-options?parentId=200",
  "/queue-options?queueOptionId=200",
  "/queue-options/200",
  "/queue-options/999"
])("foreign or missing option scope is concealed: %s", async route =>
  error(await auth(request(app).get(route)), 404, "ERR_QUEUE_NOT_FOUND")
);
test.each([
  "/queue-options?queueId=",
  "/queue-options?queueId=10&queueId=20",
  "/queue-options?parentId[x]=100",
  "/queue-options/NaN"
])("malformed ids are rejected: %s", async route =>
  error(await auth(request(app).get(route)), 400, "ERR_BAD_REQUEST")
);
test.each(["get", "put", "delete"])(
  "a common actor cannot %s options",
  async method => {
    const api = request(app);
    const builder =
      method === "get"
        ? api.get("/queue-options")
        : method === "put"
          ? api.put("/queue-options/100")
          : api.delete("/queue-options/100");
    error(
      await auth(builder, 2).send({ title: "QA changed" }),
      403,
      "ERR_NO_PERMISSION"
    );
  }
);
test.each(["company", "profile", "super", "deleted"])(
  "stale actor context blocks the upload before Multer: %s",
  async change => {
    const stale = token(change === "super" ? 3 : 1);
    const actor = mockUsers.find(
      row => row.id === (change === "super" ? 3 : 1)
    );
    if (change === "company") actor.companyId = 2;
    else if (change === "profile") actor.profile = "user";
    else if (change === "super") actor.super = false;
    else mockUsers.splice(mockUsers.indexOf(actor), 1);
    const response = await request(app)
      .post("/queue/10/media-upload")
      .set("Authorization", `Bearer ${stale}`)
      .attach("file", bytes, "fixture.txt");
    error(response, 403, "ERR_NO_PERMISSION");
    expect(writeStream).not.toHaveBeenCalled();
    expect(fs.readdirSync(mockStorageRoot)).toEqual([]);
  }
);
test.each(["/queue/20/media-upload", "/queue-options/200/media-upload"])(
  "foreign media authorization precedes all multipart writes: %s",
  async route => {
    error(await upload(route), 404, "ERR_QUEUE_NOT_FOUND");
    expect(writeStream).not.toHaveBeenCalled();
    expect(fs.readdirSync(mockStorageRoot)).toEqual([]);
  }
);
test("a current super actor remains limited to the authenticated company", async () => {
  error(await upload("/queue/20/media-upload", 3), 404, "ERR_QUEUE_NOT_FOUND");
  expect(writeStream).not.toHaveBeenCalled();
});
test.each([1, 3])(
  "own queue upload persists exact bytes with actor %i",
  async actor => {
    const response = await upload("/queue/10/media-upload", actor);
    expect(response.status).toBe(200);
    const row = mockQueues.find(queue => queue.id === 10);
    expect(row.mediaPath).toMatch(/^media\/1\//);
    expect(
      fs.readFileSync(path.join(mockStorageRoot, ...row.mediaPath.split("/")))
    ).toEqual(bytes);
    expect(
      fs
        .readdirSync(mockStorageRoot)
        .some(
          name =>
            name.startsWith("queue-upload-") ||
            name.startsWith("baseline-upload-")
        )
    ).toBe(false);
  }
);
test("own legacy-option upload preserves effective ownership and bytes", async () => {
  const response = await upload("/queue-options/101/media-upload");
  expect(response.status).toBe(200);
  const row = mockOptions.find(option => option.id === 101);
  expect(row.mediaPath).toMatch(/^media\/1\//);
  expect(
    fs.readFileSync(path.join(mockStorageRoot, ...row.mediaPath.split("/")))
  ).toEqual(bytes);
});
test.each(["put", "delete"])(
  "foreign option %s is rejected without mutation",
  async method => {
    const foreign = mockOptions.find(row => row.id === 200);
    const response = await auth(
      method === "put"
        ? request(app).put("/queue-options/200")
        : request(app).delete("/queue-options/200")
    ).send({ title: "QA foreign mutation" });
    error(response, 404, "ERR_QUEUE_NOT_FOUND");
    expect(foreign.update).not.toHaveBeenCalled();
    expect(foreign.destroy).not.toHaveBeenCalled();
  }
);
test.each([
  { queueId: 20 },
  { queueId: 10, parentId: 200 },
  { queueId: 10, forwardQueueId: 20 }
])(
  "foreign queue, parent or forwarding is rejected on creation: %p",
  async fields => {
    const response = await auth(request(app).post("/queue-options")).send({
      title: "QA new",
      option: "1",
      ...fields
    });
    error(response, 404, "ERR_QUEUE_NOT_FOUND");
    expect(QueueOption.create).not.toHaveBeenCalled();
  }
);
test("an own option edit ignores protected mass-assigned fields", async () => {
  const row = mockOptions.find(option => option.id === 100);
  const response = await auth(request(app).put("/queue-options/100")).send({
    title: "QA edited",
    id: 777,
    companyId: 2,
    mediaPath: "media/2/secret.txt",
    mediaName: "secret.txt",
    children: []
  });
  expect(response.status).toBe(200);
  expect(row.id).toBe(100);
  expect(row.mediaPath).toBe(null);
  expect(row.mediaName).toBe(null);
  expect(row.update).toHaveBeenCalledWith({ title: "QA edited" });
});
test("own option creation ignores protected fields", async () => {
  const response = await auth(request(app).post("/queue-options")).send({
    queueId: 10,
    title: "QA new",
    option: "2",
    id: 777,
    mediaPath: "media/2/secret.txt",
    companyId: 2
  });
  expect(response.status).toBe(200);
  expect(QueueOption.create).toHaveBeenCalledWith({
    queueId: 10,
    title: "QA new",
    option: "2"
  });
});
test.each([{ parentId: 100 }, { parentId: 101 }, { queueId: 11 }])(
  "self/descendant cycles and cross-queue reparenting are rejected: %p",
  async fields => {
    error(
      await auth(request(app).put("/queue-options/100")).send(fields),
      400,
      "ERR_BAD_REQUEST"
    );
    expect(
      mockOptions.find(row => row.id === 100).update
    ).not.toHaveBeenCalled();
  }
);
test("unsafe mixed-company descendants prevent deleting an own root", async () => {
  mockOptions.push(
    mockRow({ id: 500, queueId: 20, parentId: 100 }, mockOptions)
  );
  error(
    await auth(request(app).delete("/queue-options/100")),
    404,
    "ERR_QUEUE_NOT_FOUND"
  );
  expect(
    mockOptions.find(row => row.id === 100).destroy
  ).not.toHaveBeenCalled();
});
test("queue deletion validates all cascading option descendants first", async () => {
  mockOptions.push(
    mockRow({ id: 500, queueId: 20, parentId: 100 }, mockOptions)
  );
  const queue = mockQueues.find(row => row.id === 10);
  error(
    await auth(request(app).delete("/queue/10")),
    404,
    "ERR_QUEUE_NOT_FOUND"
  );
  expect(queue.destroy).not.toHaveBeenCalled();
});
test.each(["/queue/10/media-upload", "/queue-options/101/media-upload"])(
  "a common user never reaches multipart storage: %s",
  async route => {
    error(await upload(route, 2), 403, "ERR_NO_PERMISSION");
    expect(writeStream).not.toHaveBeenCalled();
  }
);
test("malformed upload target is rejected before multipart storage", async () => {
  error(await upload("/queue/NaN/media-upload"), 400, "ERR_BAD_REQUEST");
  expect(writeStream).not.toHaveBeenCalled();
});
test.each([
  "../outside.txt",
  "media/2/foreign.txt",
  "chat-12345678-1234-1234-1234-123456789012.png"
])(
  "unsafe own-row media reference cannot delete disk bytes: %s",
  async mediaPath => {
    const row = mockQueues.find(queue => queue.id === 10);
    row.mediaPath = mediaPath;
    error(
      await auth(request(app).delete("/queue/10/media-upload")),
      404,
      "ERR_QUEUE_NOT_FOUND"
    );
    expect(row.update).not.toHaveBeenCalled();
  }
);
test("own media deletion removes only its stored file", async () => {
  const row = mockQueues.find(queue => queue.id === 10);
  row.mediaPath = "media/1/fixture/own.txt";
  const target = path.join(mockStorageRoot, ...row.mediaPath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, new Uint8Array(bytes));
  const response = await auth(request(app).delete("/queue/10/media-upload"));
  expect(response.status).toBe(200);
  expect(fs.existsSync(target)).toBe(false);
  expect(row.mediaPath).toBe(null);
});
test("a symlinked storage directory cannot remove its target", async () => {
  const row = mockQueues.find(queue => queue.id === 10);
  const outside = path.join(sandbox, "outside-fixture");
  fs.mkdirSync(outside, { recursive: true });
  const file = path.join(outside, "safe.txt");
  fs.writeFileSync(file, new Uint8Array(bytes));
  const media = path.join(mockStorageRoot, "media", "1");
  fs.mkdirSync(media, { recursive: true });
  fs.symlinkSync(outside, path.join(media, "alias"), "junction");
  row.mediaPath = "media/1/alias/safe.txt";
  error(
    await auth(request(app).delete("/queue/10/media-upload")),
    404,
    "ERR_QUEUE_NOT_FOUND"
  );
  expect(fs.readFileSync(file)).toEqual(bytes);
  expect(row.update).not.toHaveBeenCalled();
});

test.each([20, 999])(
  "an owned option with legacy foreign/dangling forward %i stays readable",
  async forwardQueueId => {
    mockOptions.find(row => row.id === 100).forwardQueueId = forwardQueueId;
    const response = await auth(request(app).get("/queue-options/100"));
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(100);
    const list = await auth(request(app).get("/queue-options?queueId=10"));
    expect(list.status).toBe(200);
    expect(ids(list)).toEqual([100, 101, 102]);
  }
);

test.each([20, 999])(
  "an owned option can explicitly clear legacy invalid forward %i",
  async forwardQueueId => {
    const row = mockOptions.find(option => option.id === 100);
    row.forwardQueueId = forwardQueueId;
    const response = await auth(request(app).put("/queue-options/100")).send({
      title: "QA repaired",
      forwardQueueId: null
    });
    expect(response.status).toBe(200);
    expect(row.forwardQueueId).toBe(null);
    expect(row.update).toHaveBeenCalledWith({
      title: "QA repaired",
      forwardQueueId: null
    });
  }
);

test.each([20, 999])(
  "an option edit cannot silently retain invalid effective forward %i",
  async forwardQueueId => {
    const row = mockOptions.find(option => option.id === 100);
    row.forwardQueueId = forwardQueueId;
    const response = await auth(request(app).put("/queue-options/100")).send({
      title: "QA unchanged invalid forwarding"
    });
    error(response, 404, "ERR_QUEUE_NOT_FOUND");
    expect(row.update).not.toHaveBeenCalled();
    expect(row.forwardQueueId).toBe(forwardQueueId);
  }
);
