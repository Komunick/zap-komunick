import { promises as fs } from "fs";
import path from "path";
import os from "os";
import ChatMessage from "../../models/ChatMessage";
import {
  assertChatMediaReady,
  inspectChatMediaReadiness,
  isProtectedChatPublicPath,
  migrateChatMedia,
  summarizeChatMediaInventory
} from "../../services/ChatService/ChatMediaMigrationService";
import {
  chatMediaDirectory,
  ensureChatMediaDirectory
} from "../../config/chatMedia";
import uploadConfig from "../../config/upload";

jest.mock("../../config/upload", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  const directory = actualFs.mkdtempSync(
    actualPath.join(jest.requireActual("os").tmpdir(), "zk-chat-migration-")
  );
  return {
    __esModule: true,
    default: { directory: actualPath.join(directory, "public") }
  };
});
jest.mock("../../models/ChatMessage", () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  sequelize: { query: jest.fn(), transaction: jest.fn() }
}));

const root = path.dirname(uploadConfig.directory);
const legacy = "1890171090516.png";
const orphan = "chat-11111111-1111-4111-8111-111111111111.txt";
const control = "unrelated-control.txt";
let references: string[], shared: Record<string, object[]>;
const source = (name: string) => path.join(uploadConfig.directory, name);
const destination = (name: string) => path.join(chatMediaDirectory, name);

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-migration-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(uploadConfig.directory, { recursive: true });
  references = [legacy];
  shared = {};
  (ChatMessage.findAll as jest.Mock).mockImplementation(async () =>
    references.map(mediaPath => ({ mediaPath }))
  );
  (ChatMessage.count as jest.Mock).mockImplementation(
    async ({ where }) =>
      references.filter(name => name === where.mediaPath).length
  );
  (ChatMessage.sequelize.transaction as jest.Mock).mockImplementation(work =>
    work({})
  );
  (ChatMessage.sequelize.query as jest.Mock).mockImplementation(
    async (sql: string) => {
      const table = / FROM "([A-Za-z]+)"/.exec(sql)?.[1];
      return table ? shared[table] || [] : [];
    }
  );
  await fs.writeFile(source(legacy), "OWN FICTIONAL LEGACY PNG BYTES");
  await fs.writeFile(source(orphan), "OWN FICTIONAL ORPHAN BYTES");
  await fs.writeFile(source(control), "OTHER MODULE FICTIONAL BYTES");
});

afterAll(async () => {
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-migration-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

it("inventories references and owned UUID orphans without mutating public files or creating private storage", async () => {
  const inventory = await inspectChatMediaReadiness();
  expect(inventory.ready).toBe(false);
  expect(summarizeChatMediaInventory(inventory)).toMatchObject({
    referencedFiles: 1,
    identifiableOrphans: 1,
    pendingPublicFiles: 2
  });
  expect(await fs.readFile(source(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  await expect(fs.lstat(chatMediaDirectory)).rejects.toMatchObject({
    code: "ENOENT"
  });
  expect(inventory.files.some(file => file.name === control)).toBe(false);
});

it("migrates all identified bytes without changing raw references or another module and resumes idempotently", async () => {
  const result = await migrateChatMedia();
  expect(result.ready).toBe(true);
  expect(await fs.readFile(destination(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  expect(await fs.readFile(destination(orphan), "utf8")).toBe(
    "OWN FICTIONAL ORPHAN BYTES"
  );
  await expect(fs.lstat(source(legacy))).rejects.toMatchObject({
    code: "ENOENT"
  });
  expect(await fs.readFile(source(control), "utf8")).toBe(
    "OTHER MODULE FICTIONAL BYTES"
  );
  expect(references).toEqual([legacy]);
  expect((await migrateChatMedia()).ready).toBe(true);
  expect((await fs.stat(destination(legacy))).mode & 0o777).toBe(0o600);
  expect(
    (ChatMessage.sequelize.query as jest.Mock).mock.calls.some(([sql]) =>
      sql.startsWith("LOCK TABLE")
    )
  ).toBe(true);
});

it("blocks startup while a known public copy remains", async () => {
  await expect(assertChatMediaReady()).rejects.toThrow(
    "ERR_CHAT_MEDIA_MIGRATION_REQUIRED"
  );
  await migrateChatMedia();
  await expect(assertChatMediaReady()).resolves.toBeUndefined();
});

it("detects structural shared references before moving any file, while not reading message bodies or unrelated settings", async () => {
  shared.Announcements = [{ mediaPath: legacy }];
  await expect(migrateChatMedia()).rejects.toThrow(
    "ERR_CHAT_MEDIA_MIGRATION_CONFLICT"
  );
  expect(await fs.readFile(source(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  expect(await fs.readFile(source(orphan), "utf8")).toBe(
    "OWN FICTIONAL ORPHAN BYTES"
  );
  await expect(fs.lstat(chatMediaDirectory)).rejects.toMatchObject({
    code: "ENOENT"
  });
  const selects = (ChatMessage.sequelize.query as jest.Mock).mock.calls
    .map(([sql]) => sql)
    .filter(sql => sql.startsWith("SELECT ") && sql.includes(" FROM "));
  expect(selects).toHaveLength(8);
  expect(
    selects.every(
      sql =>
        !sql.includes("body") &&
        !sql.includes("dataJson") &&
        !sql.includes("password") &&
        !sql.includes("to_jsonb")
    )
  ).toBe(true);
});

it("never overwrites a private destination with different bytes", async () => {
  await ensureChatMediaDirectory();
  await fs.writeFile(
    destination(legacy),
    "OWN EXISTING DIFFERENT PRIVATE BYTES"
  );
  await expect(migrateChatMedia()).rejects.toThrow(
    "ERR_CHAT_MEDIA_MIGRATION_CONFLICT"
  );
  expect(await fs.readFile(destination(legacy), "utf8")).toBe(
    "OWN EXISTING DIFFERENT PRIVATE BYTES"
  );
  expect(await fs.readFile(source(orphan), "utf8")).toBe(
    "OWN FICTIONAL ORPHAN BYTES"
  );
});

it("detects another module sharing the configured frontend public ingress", async () => {
  const before = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://frontend.example.invalid";
  try {
    shared.Contacts = [
      {
        profilePicUrl: `https://frontend.example.invalid/backend/public/${legacy}`
      }
    ];
    await expect(migrateChatMedia()).rejects.toThrow(
      "ERR_CHAT_MEDIA_MIGRATION_CONFLICT"
    );
    expect(await fs.readFile(source(legacy), "utf8")).toBe(
      "OWN FICTIONAL LEGACY PNG BYTES"
    );
    await expect(fs.lstat(chatMediaDirectory)).rejects.toMatchObject({
      code: "ENOENT"
    });
  } finally {
    if (before === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = before;
  }
});

it.each(["public", "private"])(
  "refuses a %s symlink before moving good files",
  async area => {
    const unrelated = path.join(root, "unrelated.txt");
    await fs.writeFile(unrelated, "OWN UNRELATED BYTES");
    if (area === "public") {
      await fs.unlink(source(legacy));
      await fs.symlink(unrelated, source(legacy));
    } else {
      await ensureChatMediaDirectory();
      await fs.symlink(unrelated, destination(legacy));
    }
    await expect(migrateChatMedia()).rejects.toThrow(
      "ERR_CHAT_MEDIA_MIGRATION_CONFLICT"
    );
    expect(await fs.readFile(unrelated, "utf8")).toBe("OWN UNRELATED BYTES");
    expect(await fs.readFile(source(orphan), "utf8")).toBe(
      "OWN FICTIONAL ORPHAN BYTES"
    );
  }
);

it("preserves both complete copies after interruption and safely resumes the unlink", async () => {
  const original = fs.unlink.bind(fs);
  const interrupted = jest
    .spyOn(fs, "unlink")
    .mockImplementation(async filename => {
      if (filename === source(legacy))
        throw Object.assign(new Error("fixture interruption"), {
          code: "EACCES"
        });
      return original(filename);
    });
  await expect(migrateChatMedia()).rejects.toThrow("fixture interruption");
  expect(await fs.readFile(source(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  expect(await fs.readFile(destination(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  interrupted.mockRestore();
  expect((await migrateChatMedia()).ready).toBe(true);
  expect(await fs.readFile(source(control), "utf8")).toBe(
    "OTHER MODULE FICTIONAL BYTES"
  );
});

it("inventories previously missing bytes without inventing content or reading public fallbacks", async () => {
  references = ["missing.png"];
  await fs.unlink(source(orphan));
  const result = await migrateChatMedia();
  expect(result.ready).toBe(true);
  expect(summarizeChatMediaInventory(result).missingFiles).toBe(1);
  expect(await fs.readFile(source(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
});

it("does not block restart for a later public reference when no public bytes need removal", async () => {
  await migrateChatMedia();
  shared.Announcements = [{ mediaPath: legacy }];
  expect((await inspectChatMediaReadiness()).ready).toBe(true);
  expect((await migrateChatMedia()).ready).toBe(true);
  expect(await fs.readFile(destination(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
  references.push("missing.png");
  shared.Announcements.push({ mediaPath: "missing.png" });
  expect((await inspectChatMediaReadiness()).ready).toBe(true);
});

it("keeps public URLs blocked after the message is deleted and a legacy copy is reinserted", async () => {
  await migrateChatMedia();
  references = [];
  await fs.writeFile(source(legacy), "OWN FICTIONAL LEGACY PNG BYTES");
  expect(await isProtectedChatPublicPath(legacy)).toBe(true);
  expect(await isProtectedChatPublicPath(orphan)).toBe(true);
  expect(await isProtectedChatPublicPath(`other-module/${orphan}`)).toBe(false);
  expect(await isProtectedChatPublicPath(control)).toBe(false);
  expect((await inspectChatMediaReadiness()).ready).toBe(false);
  expect((await migrateChatMedia()).ready).toBe(true);
});

it("blocks malformed raw references before any move", async () => {
  references.push("../unrelated.txt");
  await expect(migrateChatMedia()).rejects.toThrow(
    "ERR_CHAT_MEDIA_MIGRATION_CONFLICT"
  );
  expect(await fs.readFile(source(legacy), "utf8")).toBe(
    "OWN FICTIONAL LEGACY PNG BYTES"
  );
});
