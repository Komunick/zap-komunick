import { promises as fs } from "fs";
import os from "os";
import path from "path";
import ErrorReport from "../../models/ErrorReport";
import { sendMail } from "../../helpers/Mailer";
import { errorReportDirectory } from "../../config/errorReportUpload";
import DeliverErrorReportService from "../../services/ErrorReportServices/DeliverErrorReportService";
import SendPendingErrorReportsService from "../../services/ErrorReportServices/SendPendingErrorReportsService";

jest.mock("../../config/privateFiles", () => {
  const actualFs = jest.requireActual("fs");
  const actualPath = jest.requireActual("path");
  return {
    __esModule: true,
    default: {
      directory: actualFs.mkdtempSync(
        actualPath.join(jest.requireActual("os").tmpdir(), "zk-error-report-")
      )
    }
  };
});
jest.mock("../../models/ErrorReport", () => ({
  __esModule: true,
  default: { update: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() }
}));
jest.mock("../../helpers/Mailer", () => ({
  ...jest.requireActual("../../helpers/Mailer"),
  sendMail: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const root = path.dirname(errorReportDirectory);
const STORED = "report-11111111-1111-4111-8111-111111111111.upload";
const MAIL_ENV = {
  ERROR_REPORT_EMAIL: "suporte@example.invalid",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_USER: "bot@example.invalid"
};
const originalEnv = { ...process.env };

const reportRow = (overrides = {}) => ({
  id: 5,
  title: "Tela trava",
  description: "Ao enviar um anexo.",
  userEmail: "ana@example.invalid",
  emailAttempts: 2,
  createdAt: new Date("2026-11-24T18:00:00Z"),
  attachments: [
    {
      storedName: STORED,
      originalName: "print.png",
      mimeType: "image/png",
      size: 4
    }
  ],
  update: jest.fn(),
  ...overrides
});

beforeEach(async () => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, ...MAIL_ENV };
  await fs.mkdir(errorReportDirectory, { recursive: true });
  await fs.writeFile(path.join(errorReportDirectory, STORED), "data");
  (ErrorReport.update as jest.Mock).mockResolvedValue([1]);
});

afterAll(async () => {
  process.env = originalEnv;
  if (
    path.dirname(root) !== os.tmpdir() ||
    !path.basename(root).startsWith("zk-error-report-")
  )
    throw new Error("Unsafe fixture root");
  await fs.rm(root, { recursive: true, force: true });
});

describe("DeliverErrorReportService", () => {
  it.each(["ERROR_REPORT_EMAIL", "SMTP_HOST"])(
    "leaves the report untouched while %s is empty",
    async name => {
      delete process.env[name];

      expect(await DeliverErrorReportService(5)).toBe("skipped");
      expect(ErrorReport.update).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    }
  );

  it("does not send a report another run already claimed", async () => {
    (ErrorReport.update as jest.Mock).mockResolvedValue([0]);

    expect(await DeliverErrorReportService(5)).toBe("skipped");
    expect(ErrorReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ emailStatus: "sending" }),
      { where: { id: 5, emailStatus: "pending" } }
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("mails the report with its files and then removes them", async () => {
    const report = reportRow();
    (ErrorReport.findByPk as jest.Mock).mockResolvedValue(report);
    (sendMail as jest.Mock).mockResolvedValue(undefined);

    expect(await DeliverErrorReportService(5)).toBe("sent");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "suporte@example.invalid",
        replyTo: "ana@example.invalid",
        subject: "[SuperChat] Reporte de erro #5: Tela trava",
        attachments: [
          {
            filename: "print.png",
            path: path.join(errorReportDirectory, STORED),
            contentType: "image/png"
          }
        ]
      })
    );
    expect(report.update).toHaveBeenCalledWith(
      expect.objectContaining({ emailStatus: "sent", emailError: null })
    );
    await expect(
      fs.access(path.join(errorReportDirectory, STORED))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps the report and its files when the mail server fails", async () => {
    const report = reportRow();
    (ErrorReport.findByPk as jest.Mock).mockResolvedValue(report);
    (sendMail as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await DeliverErrorReportService(5)).toBe("failed");
    expect(report.update).toHaveBeenCalledWith({
      emailStatus: "pending",
      emailAttempts: 3,
      emailError: "ECONNREFUSED"
    });
    await fs.access(path.join(errorReportDirectory, STORED));
  });

  it("still mails the report when a stored file is gone or has a strange name", async () => {
    const report = reportRow({
      attachments: [
        {
          storedName: "../../etc/passwd",
          originalName: "a.png",
          mimeType: "image/png",
          size: 1
        },
        {
          storedName: "report-22222222-2222-4222-8222-222222222222.upload",
          originalName: "b.pdf",
          mimeType: "application/pdf",
          size: 1
        }
      ]
    });
    (ErrorReport.findByPk as jest.Mock).mockResolvedValue(report);
    (sendMail as jest.Mock).mockResolvedValue(undefined);

    expect(await DeliverErrorReportService(5)).toBe("sent");
    const [mail] = (sendMail as jest.Mock).mock.calls[0];
    expect(mail.attachments).toEqual([]);
    expect(mail.text).toContain(
      "Anexos não encontrados no servidor: a.png; b.pdf"
    );
  });
});

describe("SendPendingErrorReportsService", () => {
  it("does nothing while the mail is not configured", async () => {
    delete process.env.SMTP_HOST;

    expect(await SendPendingErrorReportsService()).toBe(0);
    expect(ErrorReport.findAll).not.toHaveBeenCalled();
  });

  it("releases stale sends and stops at the first failure", async () => {
    (ErrorReport.findAll as jest.Mock).mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 }
    ]);
    (ErrorReport.findByPk as jest.Mock).mockImplementation(async id =>
      reportRow({ id, attachments: [] })
    );
    (sendMail as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("ETIMEDOUT"));

    expect(await SendPendingErrorReportsService()).toBe(1);
    expect((ErrorReport.update as jest.Mock).mock.calls[0][0]).toEqual({
      emailStatus: "pending"
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(ErrorReport.findByPk).not.toHaveBeenCalledWith(3);
  });
});
