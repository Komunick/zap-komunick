import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import AppError from "../../errors/AppError";
import authorizeChatUpload, {
  receiveChatUpload
} from "../../middleware/authorizeChatUpload";
import AuthorizeChatService from "../../services/ChatService/AuthorizeChatService";
import uploadConfig from "../../config/upload";
import { chatMediaDirectory } from "../../config/chatMedia";
import { removeChatUploadFiles } from "../../config/chatUpload";

jest.mock("../../config/upload", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  const directory = actualFs.mkdtempSync(
    actualPath.join(
      jest.requireActual("os").tmpdir(),
      "zk-chat-private-upload-"
    )
  );
  return {
    __esModule: true,
    default: { directory: actualPath.join(directory, "public") }
  };
});
jest.mock("../../services/ChatService/AuthorizeChatService", () => ({
  __esModule: true,
  default: jest.fn()
}));
const root = path.dirname(uploadConfig.directory);
const app = express();
app.post(
  "/chats/:id/messages",
  (req, _res, next) => {
    req.user = { id: "1", companyId: 10, profile: "user", isSuper: false };
    next();
  },
  authorizeChatUpload,
  receiveChatUpload,
  (req, res) => {
    res.json(
      (req.files as Express.Multer.File[]).map(file => ({
        filename: file.filename,
        path: file.path
      }))
    );
  }
);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error.statusCode || 500).json({ error: error.message })
);

beforeEach(async () => {
  jest.clearAllMocks();
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-private-upload-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(uploadConfig.directory, { recursive: true });
  (AuthorizeChatService as jest.Mock).mockResolvedValue({ id: 301 });
});
afterAll(async () => {
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-chat-private-upload-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

it("writes actual multipart bytes only into private storage, never public", async () => {
  const bytes = Buffer.from("OWN FICTIONAL UPLOAD BYTES");
  const reply = await request(app)
    .post("/chats/301/messages")
    .attach("medias", bytes, "fixture.txt");
  expect(reply.status).toBe(200);
  expect(reply.body).toHaveLength(1);
  expect(path.dirname(reply.body[0].path)).toBe(chatMediaDirectory);
  expect(reply.body[0].filename).toMatch(/^chat-[0-9a-f-]{36}\.txt$/);
  expect(await fs.readFile(reply.body[0].path)).toEqual(bytes);
  expect((await fs.stat(reply.body[0].path)).mode & 0o777).toBe(0o600);
  expect(await fs.readdir(uploadConfig.directory)).toEqual([]);
});

it("denies an unauthorized multipart before creating private or public files", async () => {
  (AuthorizeChatService as jest.Mock).mockRejectedValue(
    new AppError("ERR_NO_CHAT_FOUND", 404)
  );
  expect(
    (
      await request(app)
        .post("/chats/301/messages")
        .attach("medias", Buffer.from("OWN DENIED BYTES"), "denied.txt")
    ).status
  ).toBe(404);
  expect(await fs.readdir(uploadConfig.directory)).toEqual([]);
  await expect(fs.lstat(chatMediaDirectory)).rejects.toMatchObject({
    code: "ENOENT"
  });
});

it("cleans a failed multipart without leaving its earlier private file or touching public storage", async () => {
  await request(app)
    .post("/chats/301/messages")
    .attach("medias", Buffer.from("OWN FIRST BYTES"), "first.txt")
    .attach("unexpected", Buffer.from("OWN WRONG FIELD"), "wrong.txt");
  expect(await fs.readdir(chatMediaDirectory)).toEqual([]);
  expect(await fs.readdir(uploadConfig.directory)).toEqual([]);
});

it("cleanup accepts only its generated private request files and preserves other paths", async () => {
  const reply = await request(app)
    .post("/chats/301/messages")
    .attach("medias", Buffer.from("OWN CLEANUP BYTES"), "fixture.txt");
  const own = reply.body[0];
  const publicCopy = path.join(uploadConfig.directory, own.filename);
  await fs.writeFile(publicCopy, "OTHER MODULE FICTIONAL BYTES");
  await removeChatUploadFiles([
    { filename: own.filename, path: publicCopy }
  ] as Express.Multer.File[]);
  expect(await fs.readFile(publicCopy, "utf8")).toBe(
    "OTHER MODULE FICTIONAL BYTES"
  );
  await removeChatUploadFiles([own] as Express.Multer.File[]);
  await expect(fs.lstat(own.path)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(publicCopy, "utf8")).toBe(
    "OTHER MODULE FICTIONAL BYTES"
  );
});
