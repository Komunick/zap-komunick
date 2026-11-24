import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import AppError from "../../errors/AppError";
import { errorReportDirectory } from "../../config/errorReportUpload";
import errorReportRoutes from "../../routes/errorReportRoutes";
import CreateErrorReportService from "../../services/ErrorReportServices/CreateErrorReportService";
import DeliverErrorReportService from "../../services/ErrorReportServices/DeliverErrorReportService";

jest.mock("../../config/privateFiles", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  return {
    __esModule: true,
    default: {
      directory: actualFs.mkdtempSync(
        actualPath.join(
          jest.requireActual("os").tmpdir(),
          "zk-error-report-upload-"
        )
      )
    }
  };
});
jest.mock("../../middleware/isAuth", () => ({
  __esModule: true,
  default: (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization)
      return next(new AppError("ERR_SESSION_EXPIRED", 401));
    req.user = { id: "7", companyId: 2, profile: "user", isSuper: false };
    return next();
  }
}));
jest.mock(
  "../../services/ErrorReportServices/CreateErrorReportService",
  () => ({ __esModule: true, default: jest.fn() })
);
jest.mock(
  "../../services/ErrorReportServices/DeliverErrorReportService",
  () => ({ __esModule: true, default: jest.fn() })
);
jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const root = path.dirname(errorReportDirectory);
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

const app = express();
app.use(errorReportRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error.statusCode || 500).json({ error: error.message })
);

const post = () =>
  request(app).post("/error-reports").set("Authorization", "Bearer test");
const stored = async (): Promise<string[]> => {
  try {
    return await fs.readdir(errorReportDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

beforeEach(async () => {
  jest.clearAllMocks();
  await fs.rm(errorReportDirectory, { recursive: true, force: true });
  (CreateErrorReportService as jest.Mock).mockResolvedValue({ id: 31 });
  (DeliverErrorReportService as jest.Mock).mockResolvedValue("sent");
});

afterAll(async () => {
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-error-report-upload-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

it("refuses the upload of someone who is not logged in", async () => {
  const reply = await request(app)
    .post("/error-reports")
    .field("title", "x")
    .attach("files", PNG, "print.png");

  expect(reply.status).toBe(401);
  expect(await stored()).toEqual([]);
  expect(CreateErrorReportService).not.toHaveBeenCalled();
});

it("stores the report with the real type of each attachment", async () => {
  const reply = await post()
    .set("User-Agent", "Navegador de teste")
    .field("title", "Tela trava")
    .field("location", "Atendimentos")
    .field("description", "Ao enviar um anexo.")
    .field("screen", "1366x768")
    .field("appUrl", "https://superchat.example.invalid/tickets")
    .attach("files", PNG, "captura de tela ção.png")
    .attach("files", PDF, { filename: "relatorio", contentType: "text/html" });

  expect(reply.status).toBe(201);
  expect(reply.body).toEqual({ id: 31 });
  const [input] = (CreateErrorReportService as jest.Mock).mock.calls[0];
  expect(input).toMatchObject({
    userId: 7,
    companyId: 2,
    title: "Tela trava",
    location: "Atendimentos",
    description: "Ao enviar um anexo.",
    screen: "1366x768",
    userAgent: "Navegador de teste"
  });
  expect(input.attachments).toEqual([
    {
      storedName: expect.stringMatching(/^report-[0-9a-f-]{36}\.upload$/),
      originalName: "captura de tela ção.png",
      mimeType: "image/png",
      size: PNG.length
    },
    {
      storedName: expect.stringMatching(/^report-[0-9a-f-]{36}\.upload$/),
      originalName: "relatorio.pdf",
      mimeType: "application/pdf",
      size: PDF.length
    }
  ]);
  expect((await stored()).sort()).toEqual(
    input.attachments
      .map((file: { storedName: string }) => file.storedName)
      .sort()
  );
  expect(DeliverErrorReportService).toHaveBeenCalledWith(31);
});

it("accepts a report without attachments", async () => {
  const reply = await post()
    .field("title", "Tela trava")
    .field("description", "Sem anexo.");

  expect(reply.status).toBe(201);
  expect(
    (CreateErrorReportService as jest.Mock).mock.calls[0][0].attachments
  ).toEqual([]);
});

it("refuses a file that is not an image, a video or a PDF and keeps nothing", async () => {
  const reply = await post()
    .field("title", "Tela trava")
    .field("description", "Com anexo.")
    .attach("files", PNG, "print.png")
    .attach("files", Buffer.from("MZ\u0090\u0000 fake exe"), {
      filename: "print2.png",
      contentType: "image/png"
    });

  expect(reply.status).toBe(400);
  expect(reply.body).toEqual({ error: "ERR_ERROR_REPORT_FILE_TYPE" });
  expect(await stored()).toEqual([]);
  expect(CreateErrorReportService).not.toHaveBeenCalled();
});

it("refuses more than five files", async () => {
  let call = post().field("title", "x").field("description", "y");
  for (let index = 0; index < 6; index += 1)
    call = call.attach("files", PNG, `print${index}.png`);
  const reply = await call;

  expect(reply.status).toBe(400);
  expect(reply.body).toEqual({ error: "ERR_ERROR_REPORT_TOO_MANY_FILES" });
  expect(await stored()).toEqual([]);
});

it("removes the files when the report itself is refused", async () => {
  (CreateErrorReportService as jest.Mock).mockRejectedValue(
    new AppError("ERR_ERROR_REPORT_RATE_LIMIT", 429)
  );

  const reply = await post()
    .field("title", "x")
    .field("description", "y")
    .attach("files", PNG, "print.png");

  expect(reply.status).toBe(429);
  expect(reply.body).toEqual({ error: "ERR_ERROR_REPORT_RATE_LIMIT" });
  expect(await stored()).toEqual([]);
  expect(DeliverErrorReportService).not.toHaveBeenCalled();
});
