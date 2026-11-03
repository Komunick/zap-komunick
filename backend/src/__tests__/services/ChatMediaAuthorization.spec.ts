import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { sign } from "jsonwebtoken";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import routes from "../../routes/chatRoutes";
import User from "../../models/User";
import ChatMessage from "../../models/ChatMessage";
import AppError from "../../errors/AppError";
import AuthorizeChatService from "../../services/ChatService/AuthorizeChatService";
import { checkSignInIp } from "../../services/SecurityServices/IpAllowlistService";
import { canAccessNow } from "../../helpers/AccessHours";
import {
  chatMediaDirectory,
  ensureChatMediaDirectory
} from "../../config/chatMedia";
import uploadConfig from "../../config/upload";

jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: {
    secret: "fictional-access-key-only-for-offline-tests",
    refreshSecret: "fictional-refresh-key-only-for-offline-tests"
  }
}));
jest.mock("../../config/upload", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  const directory = actualFs.mkdtempSync(
    actualPath.join(jest.requireActual("os").tmpdir(), "zk-chat-private-http-")
  );
  return {
    __esModule: true,
    default: { directory: actualPath.join(directory, "public") }
  };
});
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/ChatMessage", () => ({ findOne: jest.fn() }));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  requestIp: (req: Request) => req.ip
}));
jest.mock("../../services/SecurityServices/IpAllowlistService", () => ({
  checkSignInIp: jest.fn()
}));
jest.mock("../../helpers/AccessHours", () => ({ canAccessNow: jest.fn() }));
jest.mock("../../services/ChatService/AuthorizeChatService", () => ({
  __esModule: true,
  default: jest.fn(),
  withChatTransaction: (work: (transaction: object) => unknown) => work({})
}));
jest.mock("../../controllers/ChatController", () =>
  Object.fromEntries(
    [
      "index",
      "show",
      "messages",
      "store",
      "direct",
      "update",
      "remove",
      "checkAsRead",
      "saveMessage"
    ].map(name => [
      name,
      (_req: Request, res: Response) => res.json({ ok: true })
    ])
  )
);

const server = express();
server.use(cookieParser());
server.use(routes);
server.use(
  (error: AppError, _req: Request, res: Response, _next: NextFunction) =>
    res.status(error.statusCode || 500).json({ error: error.message })
);
const root = path.dirname(uploadConfig.directory);
const filename = "chat-11111111-1111-4111-8111-111111111111.mp4";
const bytes = Buffer.from(
  "\0\0\0\x18ftypisom\0\0\0\0isomOWN-FICTIONAL-PRIVATE-MEDIA-BYTES",
  "binary"
);
let people: {
  id: number;
  companyId: number;
  tokenVersion: number;
  profile: string;
  super: boolean;
}[];
let mediaName: string, storedName: string, category: string;
function token(
  id = 1,
  companyId = 10,
  cookie = false,
  extra: object = {},
  options: object = {}
) {
  return sign(
    { id, companyId, ...(cookie ? { tokenVersion: 3 } : {}), ...extra },
    cookie
      ? "fictional-refresh-key-only-for-offline-tests"
      : "fictional-access-key-only-for-offline-tests",
    { expiresIn: "5m", ...options }
  );
}
function media(method: "get" | "head" = "get", chat = "301", message = "901") {
  return request(server)
    [method](`/chats/${chat}/messages/${message}/media`)
    .buffer(true)
    .parse((response, done) => {
      const chunks: Uint8Array[] = [];
      response.on("data", chunk => chunks.push(new Uint8Array(chunk)));
      response.on("end", () => done(null, Buffer.concat(chunks)));
      response.on("error", done);
    });
}

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-private-http-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(uploadConfig.directory, { recursive: true });
  await ensureChatMediaDirectory();
  await fs.writeFile(
    path.join(chatMediaDirectory, filename),
    new Uint8Array(bytes)
  );
  people = [
    { id: 1, companyId: 10, tokenVersion: 3, profile: "user", super: false },
    { id: 2, companyId: 10, tokenVersion: 3, profile: "admin", super: true },
    { id: 3, companyId: 20, tokenVersion: 3, profile: "user", super: false }
  ];
  mediaName = "fictional.mp4";
  category = "video";
  storedName = filename;
  (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
    people.find(
      person => person.id === where.id && person.companyId === where.companyId
    )
  );
  (canAccessNow as jest.Mock).mockReturnValue(true);
  (checkSignInIp as jest.Mock).mockResolvedValue(true);
  (AuthorizeChatService as jest.Mock).mockImplementation(
    async (chat, actor) => {
      if (
        String(chat) !== "301" ||
        String(actor.userId) !== "1" ||
        actor.companyId !== 10
      )
        throw new AppError("ERR_NO_CHAT_FOUND", 404);
      return { id: 301 };
    }
  );
  (ChatMessage.findOne as jest.Mock).mockImplementation(async ({ where }) =>
    where.id === 901 && where.chatId === 301
      ? { mediaName, mediaType: category, getDataValue: () => storedName }
      : null
  );
});

afterAll(async () => {
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-private-http-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

it.each(["bearer", "cookie", "both"])(
  "serves authenticated bytes through %s without a token or filename in the URL",
  async kind => {
    const call = media();
    if (kind !== "cookie") call.set("Authorization", `Bearer ${token()}`);
    if (kind !== "bearer") call.set("Cookie", `jrt=${token(1, 10, true)}`);
    const response = await call;
    expect(response.status).toBe(200);
    expect(response.body).toEqual(bytes);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Authorization");
    expect(response.headers.vary).toContain("Cookie");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["access-control-expose-headers"]).toContain(
      "Content-Disposition"
    );
    expect(response.headers["content-disposition"]).toBe("inline");
    expect(response.headers["content-security-policy"]).toBeUndefined();
  }
);

it.each([
  ["absent", undefined, undefined],
  ["query is not authentication", undefined, undefined],
  ["invalid bearer plus valid cookie", "Bearer invalid", true],
  ["wrong scheme plus valid cookie", "Basic invalid", true],
  ["expired bearer plus valid cookie", "expired", true],
  ["valid bearer plus invalid cookie", "valid", "invalid"],
  ["valid bearer plus expired cookie", "valid", "expired"],
  ["valid bearer plus wrong tokenVersion", "valid", "wrong-version"],
  ["different actors", "valid", "other-actor"],
  ["different companies", "valid", "other-company"]
])(
  "fails closed before bytes or file metadata: %s",
  async (name, header, cookie) => {
    const call = media()
      .set("Range", "bytes=0-3")
      .set("If-None-Match", '"fixture"');
    if (name === "query is not authentication") call.query({ token: token() });
    if (header)
      call.set(
        "Authorization",
        header === "valid"
          ? `Bearer ${token()}`
          : header === "expired"
            ? `Bearer ${token(1, 10, false, {}, { expiresIn: -1 })}`
            : header
      );
    if (cookie)
      call.set(
        "Cookie",
        `jrt=${cookie === true ? token(1, 10, true) : cookie === "expired" ? token(1, 10, true, {}, { expiresIn: -1 }) : cookie === "wrong-version" ? token(1, 10, true, { tokenVersion: 2 }) : cookie === "other-actor" ? token(2, 10, true) : cookie === "other-company" ? token(1, 20, true) : "invalid"}`
      );
    const response = await call;
    expect(response.status).toBe(401);
    expect(response.headers["content-range"]).toBeUndefined();
    expect(response.headers["content-disposition"]).toBeUndefined();
    expect(response.body.toString()).not.toContain(bytes.toString());
    expect(ChatMessage.findOne).not.toHaveBeenCalled();
  }
);

it.each([
  [2, 10],
  [3, 20]
])(
  "does not give nonparticipants or foreign actors a metadata/Range bypass (%s/%s)",
  async (id, company) => {
    const response = await media()
      .set("Cookie", `jrt=${token(id, company, true)}`)
      .set("Range", "bytes=0-3");
    expect(response.status).toBe(404);
    expect(response.headers["content-range"]).toBeUndefined();
    expect(response.headers["content-disposition"]).toBeUndefined();
    expect(JSON.parse(response.body.toString())).toEqual({
      error: "ERR_NO_CHAT_FOUND"
    });
    expect(ChatMessage.findOne).not.toHaveBeenCalled();
  }
);

it("rejects a cookie after the current actor is transferred or its tokenVersion changes", async () => {
  people[0].companyId = 20;
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(401);
  people[0].companyId = 10;
  people[0].tokenVersion = 4;
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(401);
});

it("does not extend cookie authentication to ordinary chat APIs", async () => {
  const response = await request(server)
    .get("/chats/301/messages")
    .set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
});

it("applies current access-hours and IP policy without refreshing or writing the session", async () => {
  (canAccessNow as jest.Mock).mockReturnValue(false);
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(401);
  expect(AuthorizeChatService).not.toHaveBeenCalled();
  (canAccessNow as jest.Mock).mockReturnValue(true);
  (checkSignInIp as jest.Mock).mockResolvedValue(false);
  expect((await media().set("Authorization", `Bearer ${token()}`)).status).toBe(
    403
  );
  expect(AuthorizeChatService).not.toHaveBeenCalled();
});

it("keeps native HEAD, Range, conditional and download semantics behind authorization", async () => {
  const ranged = await media()
    .set("Cookie", `jrt=${token(1, 10, true)}`)
    .set("Range", "bytes=0-3");
  expect(ranged.status).toBe(206);
  expect(ranged.body).toEqual(bytes.subarray(0, 4));
  expect(ranged.headers["content-range"]).toBe(`bytes 0-3/${bytes.length}`);
  const head = await media("head").set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(head.status).toBe(200);
  expect(head.headers["content-length"]).toBe(String(bytes.length));
  expect(head.headers["content-disposition"]).toBe("inline");
  const invalid = await media()
    .set("Authorization", `Bearer ${token()}`)
    .set("Range", "bytes=99999-");
  expect(invalid.status).toBe(416);
  expect(invalid.headers["content-range"]).toBe(`bytes */${bytes.length}`);
  const first = await media().set("Authorization", `Bearer ${token()}`);
  expect(first.headers.etag).toBeTruthy();
  expect(
    (
      await media()
        .set("Authorization", `Bearer ${token()}`)
        .set("If-None-Match", first.headers.etag)
    ).status
  ).toBe(304);
  expect((await media().set("If-None-Match", first.headers.etag)).status).toBe(
    401
  );
  const download = await media()
    .query({ download: 1 })
    .set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(download.headers["content-disposition"]).toContain(
    'attachment; filename="fictional.mp4"'
  );
});

it.each(["902", "-1"])(
  "requires the message to belong to the authorized chat: %s",
  async message => {
    const response = await media("get", "301", message).set(
      "Authorization",
      `Bearer ${token()}`
    );
    expect(response.status).toBe(404);
    expect(response.body.toString()).not.toContain(bytes.toString());
  }
);

it("does not fall back to public bytes or follow a symlink", async () => {
  await fs.unlink(path.join(chatMediaDirectory, filename));
  await fs.writeFile(
    path.join(uploadConfig.directory, filename),
    new Uint8Array(bytes)
  );
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(404);
  await fs.symlink(
    path.join(uploadConfig.directory, filename),
    path.join(chatMediaDirectory, filename)
  );
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(404);
  storedName = "../unrelated.txt";
  expect(
    (await media().set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(404);
});

it.each(["unsafe.html", "unsafe.svg"])(
  "forces active content to download as binary: %s",
  async name => {
    mediaName = name;
    storedName = filename.replace(/\.mp4$/, path.extname(name));
    await fs.rename(
      path.join(chatMediaDirectory, filename),
      path.join(chatMediaDirectory, storedName)
    );
    const response = await media().set("Cookie", `jrt=${token(1, 10, true)}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-security-policy"]).toContain("sandbox");
  }
);

it("derives MIME from validated storage rather than a misleading display name", async () => {
  mediaName = "misleading.png";
  storedName = filename.replace(/\.mp4$/, ".svg");
  await fs.rename(
    path.join(chatMediaDirectory, filename),
    path.join(chatMediaDirectory, storedName)
  );
  const response = await media().set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toBe("application/octet-stream");
  expect(response.headers["content-disposition"]).toContain("attachment");
});

it("preserves native media type when a legacy message has no original display name", async () => {
  mediaName = "";
  const response = await media().set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toBe("video/mp4");
  expect(response.headers["content-disposition"]).toBe("inline");
});

it.each([
  ["image", "image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
  ["image", "image/jpeg", [255, 216, 255, 224]],
  [
    "application",
    "application/pdf",
    Array.from("%PDF-1.7").map(character => character.charCodeAt(0))
  ],
  [
    "audio",
    "audio/ogg",
    Array.from("OggS\0fictional").map(character => character.charCodeAt(0))
  ],
  [
    "audio",
    "audio/wav",
    Array.from("RIFFxxxxWAVEfmt ").map(character => character.charCodeAt(0))
  ],
  ["audio", "audio/mpeg", [255, 251, 144, 0]],
  ["video", "video/mp4", Array.from(bytes)],
  ["audio", "audio/mp4", Array.from(bytes)]
])(
  "preserves authorized legacy media without extension: %s/%s",
  async (mediaCategory, expectedMime, content) => {
    storedName = "1890171090516";
    mediaName = "camera";
    category = mediaCategory as string;
    await fs.writeFile(
      path.join(chatMediaDirectory, storedName),
      new Uint8Array(content as number[])
    );
    const response = await media("head").set(
      "Cookie",
      `jrt=${token(1, 10, true)}`
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(expectedMime);
    expect(response.headers["content-disposition"]).toBe("inline");
  }
);

it("authorizes before opening bytes and bounds the MIME prefix to 512 bytes", async () => {
  const original = fs.open.bind(fs);
  const lengths: number[] = [];
  const open = jest.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await original(...args);
    const read = handle.read.bind(handle) as (
      ...values: unknown[]
    ) => Promise<unknown>;
    handle.read = jest.fn((...values: unknown[]) => {
      lengths.push((values[0] as Uint8Array).byteLength);
      return read(...values);
    }) as typeof handle.read;
    return handle;
  });
  expect((await media("head")).status).toBe(401);
  expect(open).not.toHaveBeenCalled();
  expect(
    (await media("head").set("Cookie", `jrt=${token(1, 10, true)}`)).status
  ).toBe(200);
  expect(lengths).toHaveLength(1);
  expect(lengths[0]).toBeLessThanOrEqual(512);
});

it("uses the existing bounded safe filename rule for download headers", async () => {
  mediaName = "x".repeat(1000) + ".mp4";
  const response = await media()
    .query({ download: 1 })
    .set("Cookie", `jrt=${token(1, 10, true)}`);
  expect(response.status).toBe(200);
  expect(response.headers["content-disposition"].length).toBeLessThan(500);
});
