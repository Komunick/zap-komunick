import "express-async-errors";
import express from "express";
import request from "supertest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import AppError from "../../errors/AppError";
import attachmentRoutes from "../../routes/attachmentRoutes";
import {
  getTicketAttachment,
  listTicketAttachments,
  openTicketAttachment
} from "../../services/AttachmentServices/TicketAttachmentService";

jest.mock("../../services/AttachmentServices/TicketAttachmentService", () => ({
  getTicketAttachment: jest.fn(),
  listTicketAttachments: jest.fn(),
  openTicketAttachment: jest.fn()
}));
jest.mock("../../middleware/isAuth", () => (req, res, next) => {
  if (req.headers.authorization !== "Bearer fictitious")
    return res.status(401).json({ error: "ERR_UNAUTHORIZED" });
  req.user = { id: "101", companyId: 10 };
  next();
});
jest.mock("../../middleware/isCompliant", () => (req, res, next) => {
  if (req.headers["x-fictional-expired"])
    return res.status(402).json({ error: "ERR_SUBSCRIPTION_EXPIRED" });
  next();
});
jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));
const base = "/tickets/301/attachments/300/message-fixture";
const data = "%PDF-1.7\nFICTITIOUS-BYTES\n";
describe("actual attachment router headers, HEAD and byte ranges with fictitious temporary bytes", () => {
  const app = express();
  app.use(attachmentRoutes);
  app.use(
    (
      error: AppError,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => res.status(error.statusCode || 500).json({ error: error.message })
  );
  let temp: string;
  let file: string;
  let close: jest.SpyInstance;
  beforeAll(async () => {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), "zk-attachment-http-test-"));
    file = path.join(temp, "fiction.pdf");
    await fs.writeFile(file, data);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (listTicketAttachments as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null
    });
    (getTicketAttachment as jest.Mock).mockResolvedValue({
      messageId: "message-fixture",
      sourceTicketId: 300
    });
    (openTicketAttachment as jest.Mock).mockImplementation(async () => {
      const handle = await fs.open(file, "r");
      close = jest.spyOn(handle, "close");
      return {
        handle,
        size: data.length,
        mimeType: "application/pdf",
        fileName: 'safe"\r\nname.pdf'
      };
    });
  });
  afterAll(async () => {
    await fs.rm(temp, { recursive: true, force: true });
  });
  it("forwards only the authenticated actor and composite IDs to detail and returns the direct DTO", async () => {
    const response = await request(app)
      .get(base)
      .set("Authorization", "Bearer fictitious");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      messageId: "message-fixture",
      sourceTicketId: 300
    });
    expect(getTicketAttachment).toHaveBeenCalledWith(
      "301",
      { userId: "101", companyId: 10 },
      "300",
      "message-fixture",
      {}
    );
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
  it("mounts list separately and preserves the pagination envelope", async () => {
    const response = await request(app)
      .get("/tickets/301/attachments?limit=2&kind=pdf")
      .set("Authorization", "Bearer fictitious");
    expect(response.body).toEqual({
      items: [],
      hasMore: false,
      nextCursor: null
    });
    expect(listTicketAttachments).toHaveBeenCalledWith(
      "301",
      { userId: "101", companyId: 10 },
      { limit: "2", kind: "pdf" }
    );
  });
  it.each(["get", "head"])(
    "requires Bearer on %s content before opening bytes",
    async method => {
      const response = await request(app)[method](`${base}/content`);
      expect(response.status).toBe(401);
      expect(openTicketAttachment).not.toHaveBeenCalled();
    }
  );
  it("preserves the company compliance middleware on byte access", async () => {
    const response = await request(app)
      .get(`${base}/content`)
      .set("Authorization", "Bearer fictitious")
      .set("x-fictional-expired", "yes");
    expect(response.status).toBe(402);
    expect(openTicketAttachment).not.toHaveBeenCalled();
  });
  it("HEAD authenticates, closes the descriptor and exposes the bounded exact size without a body", async () => {
    const response = await request(app)
      .head(`${base}/content`)
      .set("Authorization", "Bearer fictitious");
    expect(response.status).toBe(200);
    expect(response.text).toBeUndefined();
    expect(response.headers).toMatchObject({
      "content-type": "application/pdf",
      "content-length": String(data.length),
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    });
    expect(response.headers["content-disposition"]).not.toMatch(/[\r\n]/);
    expect(close).toHaveBeenCalled();
  });
  it.each([
    [undefined, 200, data],
    ["bytes=0-4", 206, "%PDF-"],
    ["bytes=-6", 206, "BYTES\n"]
  ])("returns actual bytes for %s", async (range, status, expected) => {
    const query = request(app)
      .get(`${base}/content`)
      .set("Authorization", "Bearer fictitious");
    if (range) query.set("Range", range);
    const response = await query.buffer(true).parse((res, callback) => {
      let result = "";
      res.setEncoding("utf8");
      res.on("data", chunk => {
        result += chunk;
      });
      res.on("end", () => callback(null, result));
    });
    expect(response.status).toBe(status);
    expect(response.body).toBe(expected);
    expect(Number(response.headers["content-length"])).toBe(expected.length);
    if (range === "bytes=0-4")
      expect(response.headers["content-range"]).toBe(
        `bytes 0-4/${data.length}`
      );
  });
  it("normalizes a descriptor stream setup error and closes before any content headers", async () => {
    const closed = jest.fn().mockResolvedValue(undefined);
    (openTicketAttachment as jest.Mock).mockResolvedValue({
      handle: {
        close: closed,
        createReadStream: () => {
          throw new Error("PRIVATE_FILENAME_CANARY");
        }
      },
      size: 50,
      mimeType: "application/pdf",
      fileName: "fixture.pdf"
    });
    const response = await request(app)
      .get(`${base}/content`)
      .set("Authorization", "Bearer fictitious");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "ERR_ATTACHMENT_UNAVAILABLE" });
    expect(closed).toHaveBeenCalled();
  });
  it.each(["bytes=999-", "bytes=0-1,4-5", "garbage"])(
    "returns 416 and closes the descriptor for %s",
    async range => {
      const response = await request(app)
        .get(`${base}/content`)
        .set("Authorization", "Bearer fictitious")
        .set("Range", range);
      expect(response.status).toBe(416);
      expect(response.body).toEqual({ error: "ERR_ATTACHMENT_RANGE" });
      expect(response.headers["content-range"]).toBe(`bytes */${data.length}`);
      expect(close).toHaveBeenCalled();
    }
  );
});
