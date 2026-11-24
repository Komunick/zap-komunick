import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import AppError from "../../errors/AppError";
import { supportDirectory } from "../../config/supportUpload";
import supportRoutes from "../../routes/supportRoutes";
import * as service from "../../services/SupportServices/SupportTicketService";
import * as alertService from "../../services/SupportServices/SupportAlertService";

jest.mock("../../config/privateFiles", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  return {
    __esModule: true,
    default: {
      directory: actualFs.mkdtempSync(
        actualPath.join(jest.requireActual("os").tmpdir(), "zk-support-upload-")
      )
    }
  };
});
jest.mock("../../middleware/isAuth", () => ({
  __esModule: true,
  default: (req: Request, _res: Response, next: NextFunction) => {
    const who = req.headers.authorization;
    if (!who) return next(new AppError("ERR_SESSION_EXPIRED", 401));
    req.user =
      who === "Bearer super"
        ? { id: "1", companyId: 1, profile: "admin", isSuper: true }
        : { id: "7", companyId: 2, profile: "user", isSuper: false };
    return next();
  }
}));
jest.mock("../../services/SupportServices/SupportTicketService", () => ({
  createSupportTicket: jest.fn(),
  createSupportMessage: jest.fn(),
  listSupportTickets: jest.fn(),
  markSupportTicketRead: jest.fn(),
  runSupportAction: jest.fn(),
  showSupportTicket: jest.fn(),
  supportAttachmentFile: jest.fn(),
  supportSummary: jest.fn()
}));
jest.mock("../../services/SupportServices/SupportAlertService", () => ({
  rotateSupportAlertToken: jest.fn(),
  revokeSupportAlertToken: jest.fn(),
  supportAlertFeed: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const mocked = service as jest.Mocked<typeof service>;
const mockedAlert = alertService as jest.Mocked<typeof alertService>;
const root = path.dirname(supportDirectory);
const PNG = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...new Array(32).fill(0)
]);
const PDF = Buffer.from("%PDF-1.7\n%fake");
const STORED = /^support-[0-9a-f-]{36}\.upload$/;
const user = { userId: 7, companyId: 2, isSuper: false };

const app = express();
app.use(express.json());
app.use(supportRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error.statusCode || 500).json({ error: error.message })
);

const as = (who: string, call: request.Test) =>
  call.set("Authorization", `Bearer ${who}`);
const stored = async (): Promise<string[]> => {
  try {
    return await fs.readdir(supportDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

beforeEach(async () => {
  jest.clearAllMocks();
  await fs.rm(supportDirectory, { recursive: true, force: true });
  mocked.createSupportTicket.mockResolvedValue({ id: 31 } as never);
  mocked.createSupportMessage.mockResolvedValue({
    ticket: { id: 31 }
  } as never);
});

afterAll(async () => {
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-support-upload-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

it.each([
  ["get", "/support/summary"],
  ["get", "/support/tickets"],
  ["post", "/support/tickets"],
  ["get", "/support/tickets/5"],
  ["post", "/support/tickets/5/messages"],
  ["post", "/support/tickets/5/actions"],
  ["post", "/support/tickets/5/read"],
  ["get", "/support/tickets/5/attachments/x"]
] as const)("refuses %s %s without a session", async (method, url) => {
  const reply = await request(app)[method](url);

  expect(reply.status).toBe(401);
  [
    mocked.createSupportTicket,
    mocked.createSupportMessage,
    mocked.listSupportTickets,
    mocked.markSupportTicketRead,
    mocked.runSupportAction,
    mocked.showSupportTicket,
    mocked.supportAttachmentFile,
    mocked.supportSummary
  ].forEach(mock => expect(mock).not.toHaveBeenCalled());
});

it("opens a ticket with the real type of each attachment", async () => {
  const reply = await as(
    "user",
    request(app)
      .post("/support/tickets")
      .set("User-Agent", "Navegador de teste")
      .field("title", "Tela trava")
      .field("description", "Ao enviar um anexo.")
      .field("category", "error")
      .field("priority", "high")
      .field("location", "Atendimentos")
      .field("screen", "1366x768")
      .attach("files", PNG, "captura de tela ção.png")
      .attach("files", PDF, { filename: "relatorio", contentType: "text/html" })
  );

  expect(reply.status).toBe(201);
  const [viewer, input] = mocked.createSupportTicket.mock.calls[0];
  expect(viewer).toEqual(user);
  expect(input).toMatchObject({
    title: "Tela trava",
    description: "Ao enviar um anexo.",
    category: "error",
    priority: "high",
    location: "Atendimentos",
    screen: "1366x768",
    userAgent: "Navegador de teste"
  });
  expect(input.attachments).toEqual([
    {
      storedName: expect.stringMatching(STORED),
      originalName: "captura de tela ção.png",
      mimeType: "image/png",
      size: PNG.length
    },
    {
      storedName: expect.stringMatching(STORED),
      originalName: "relatorio.pdf",
      mimeType: "application/pdf",
      size: PDF.length
    }
  ]);
  expect((await stored()).sort()).toEqual(
    input.attachments.map(file => file.storedName).sort()
  );
});

it("sends a message with an attachment to the ticket of the route", async () => {
  const reply = await as(
    "super",
    request(app)
      .post("/support/tickets/31/messages")
      .field("body", "Segue o print.")
      .attach("files", PNG, "print.png")
  );

  expect(reply.status).toBe(201);
  const [viewer, ticketId, input] = mocked.createSupportMessage.mock.calls[0];
  expect(viewer).toEqual({ userId: 1, companyId: 1, isSuper: true });
  expect(ticketId).toBe(31);
  expect(input.body).toBe("Segue o print.");
  expect(input.attachments).toHaveLength(1);
});

it("refuses a file that is not an image, a video or a PDF and keeps nothing", async () => {
  const reply = await as(
    "user",
    request(app)
      .post("/support/tickets/31/messages")
      .field("body", "x")
      .attach("files", PNG, "print.png")
      .attach("files", Buffer.from("MZ\u0090\u0000 fake exe"), {
        filename: "print2.png",
        contentType: "image/png"
      })
  );

  expect(reply.status).toBe(400);
  expect(reply.body).toEqual({ error: "ERR_SUPPORT_FILE_TYPE" });
  expect(await stored()).toEqual([]);
  expect(mocked.createSupportMessage).not.toHaveBeenCalled();
});

it("refuses more than five files", async () => {
  let call = request(app).post("/support/tickets").field("title", "x");
  for (let index = 0; index < 6; index += 1)
    call = call.attach("files", PNG, `print${index}.png`);
  const reply = await as("user", call);

  expect(reply.status).toBe(400);
  expect(reply.body).toEqual({ error: "ERR_SUPPORT_TOO_MANY_FILES" });
  expect(await stored()).toEqual([]);
});

it("removes the files when the ticket itself is refused", async () => {
  mocked.createSupportTicket.mockRejectedValue(
    new AppError("ERR_SUPPORT_RATE_LIMIT", 429)
  );

  const reply = await as(
    "user",
    request(app)
      .post("/support/tickets")
      .field("title", "x")
      .attach("files", PNG, "print.png")
  );

  expect(reply.status).toBe(429);
  expect(await stored()).toEqual([]);
});

it("answers 404 to a ticket id that is not a number", async () => {
  const reply = await as("user", request(app).get("/support/tickets/abc"));

  expect(reply.status).toBe(404);
  expect(reply.body).toEqual({ error: "ERR_SUPPORT_TICKET_NOT_FOUND" });
  expect(mocked.showSupportTicket).not.toHaveBeenCalled();
});

it("passes list filters, actions and reads to the service as the caller", async () => {
  mocked.listSupportTickets.mockResolvedValue([]);
  mocked.runSupportAction.mockResolvedValue({ ticket: { id: 5 } } as never);
  mocked.supportSummary.mockResolvedValue({ unread: 2, mineUnread: 2 });

  await as(
    "user",
    request(app)
      .get("/support/tickets")
      .query({ scope: "queue", search: "ana" })
  );
  expect(mocked.listSupportTickets).toHaveBeenCalledWith(user, {
    scope: "queue",
    search: "ana"
  });

  await as(
    "user",
    request(app)
      .post("/support/tickets/5/actions")
      .send({ action: "cancel", text: "Não preciso mais." })
  );
  expect(mocked.runSupportAction).toHaveBeenCalledWith(user, 5, {
    action: "cancel",
    text: "Não preciso mais."
  });

  const read = await as("user", request(app).post("/support/tickets/5/read"));
  expect(read.status).toBe(204);
  expect(mocked.markSupportTicketRead).toHaveBeenCalledWith(user, 5);

  const summary = await as("user", request(app).get("/support/summary"));
  expect(summary.body).toEqual({ unread: 2, mineUnread: 2 });
});

it("serves an attachment with its real type and no sniffing", async () => {
  await fs.mkdir(supportDirectory, { recursive: true });
  const name = "support-11111111-1111-4111-8111-111111111111.upload";
  const filePath = path.join(supportDirectory, name);
  await fs.writeFile(filePath, new Uint8Array(PNG));
  mocked.supportAttachmentFile.mockResolvedValue({
    filePath,
    attachment: {
      storedName: name,
      originalName: "captura ção.png",
      mimeType: "image/png",
      size: PNG.length
    }
  });

  const reply = await as(
    "user",
    request(app).get(`/support/tickets/5/attachments/${name}`)
  );

  expect(reply.status).toBe(200);
  expect(reply.headers["content-type"]).toBe("image/png");
  expect(reply.headers["x-content-type-options"]).toBe("nosniff");
  expect(reply.headers["content-disposition"]).toBe(
    "inline; filename*=UTF-8''captura%20%C3%A7%C3%A3o.png"
  );
  expect(reply.headers["cache-control"]).toContain("private");
  expect(Array.from(reply.body as Buffer)).toEqual(Array.from(PNG));
  expect(mocked.supportAttachmentFile).toHaveBeenCalledWith(user, 5, name);
});

it("answers 404 when the service refuses the attachment or the file is gone", async () => {
  mocked.supportAttachmentFile.mockRejectedValueOnce(
    new AppError("ERR_SUPPORT_TICKET_NOT_FOUND", 404)
  );
  const refused = await as(
    "user",
    request(app).get("/support/tickets/5/attachments/outro")
  );
  expect(refused.status).toBe(404);

  mocked.supportAttachmentFile.mockResolvedValueOnce({
    filePath: path.join(supportDirectory, "support-gone.upload"),
    attachment: {
      storedName: "x",
      originalName: "a.png",
      mimeType: "image/png",
      size: 1
    }
  });
  const gone = await as(
    "user",
    request(app).get("/support/tickets/5/attachments/x")
  );
  expect(gone.status).toBe(404);
});

describe("Windows alert of the support desk", () => {
  const KEY = `sca_${"a".repeat(43)}`;

  it("reads the feed with the alert key, without a session", async () => {
    mockedAlert.supportAlertFeed.mockResolvedValue({ unread: 0, tickets: [] });

    const reply = await request(app)
      .get("/support/alerts")
      .set("Authorization", `Bearer ${KEY}`);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ unread: 0, tickets: [] });
    expect(reply.headers["cache-control"]).toBe("no-store");
    expect(mockedAlert.supportAlertFeed).toHaveBeenCalledWith(KEY);
  });

  it.each([
    ["no header", undefined],
    ["a session token", "Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc"],
    ["a malformed key", "Bearer sca_curta"]
  ])("hands %s to the service as no key at all", async (_name, header) => {
    mockedAlert.supportAlertFeed.mockRejectedValue(
      new AppError("ERR_SUPPORT_ALERT_UNAUTHORIZED", 401)
    );
    const call = request(app).get("/support/alerts");
    const reply = await (header ? call.set("Authorization", header) : call);

    expect(reply.status).toBe(401);
    expect(reply.body).toEqual({ error: "ERR_SUPPORT_ALERT_UNAUTHORIZED" });
    expect(mockedAlert.supportAlertFeed).toHaveBeenCalledWith(null);
  });

  it("lets only a super administrator create or revoke the key", async () => {
    mockedAlert.rotateSupportAlertToken.mockResolvedValue(KEY);

    const anonymous = await request(app).post("/support/alert-token");
    expect(anonymous.status).toBe(401);
    const user = await as("user", request(app).post("/support/alert-token"));
    expect(user.status).toBe(403);
    const userRevoke = await as(
      "user",
      request(app).delete("/support/alert-token")
    );
    expect(userRevoke.status).toBe(403);
    expect(mockedAlert.rotateSupportAlertToken).not.toHaveBeenCalled();
    expect(mockedAlert.revokeSupportAlertToken).not.toHaveBeenCalled();

    const created = await as(
      "super",
      request(app).post("/support/alert-token")
    );
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ token: KEY });
    expect(created.headers["cache-control"]).toBe("no-store");

    const revoked = await as(
      "super",
      request(app).delete("/support/alert-token")
    );
    expect(revoked.status).toBe(204);
    expect(mockedAlert.revokeSupportAlertToken).toHaveBeenCalledTimes(1);
  });
});
