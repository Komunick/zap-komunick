import {
  ERROR_REPORT_TITLE_MAX,
  errorReportFileType,
  errorReportText
} from "../../helpers/ErrorReportRules";
import { errorReportMail } from "../../helpers/ErrorReportMail";
import { isEmailAddress, mailSettings } from "../../helpers/Mailer";

const bytes = (...values: (number | string)[]): Buffer =>
  Buffer.from(
    values.flatMap(value =>
      typeof value === "number"
        ? [value]
        : Array.from(value).map(character => character.charCodeAt(0))
    )
  );

describe("errorReportFileType", () => {
  it.each([
    [bytes(0x89, "PNG\r\n", 0x1a, "\n"), "image/png"],
    [bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    [bytes("GIF89a"), "image/gif"],
    [bytes("RIFF", 0, 0, 0, 0, "WEBP"), "image/webp"],
    [bytes("%PDF-1.7"), "application/pdf"],
    [bytes(0, 0, 0, 0x20, "ftypisom"), "video/mp4"],
    [bytes(0, 0, 0, 0x14, "ftypqt  "), "video/quicktime"],
    [bytes(0x1a, 0x45, 0xdf, 0xa3), "video/webm"]
  ])("recognizes the content of %p as %s", (content, mimeType) => {
    expect(errorReportFileType(content)?.mimeType).toBe(mimeType);
  });

  it.each([
    bytes("MZ", 0x90, 0),
    bytes("<html><script>"),
    bytes("PK", 3, 4),
    bytes("#!/bin/sh\n"),
    bytes("RIFF", 0, 0, 0, 0, "AVI "),
    Buffer.alloc(0)
  ])("refuses the content %p", content => {
    expect(errorReportFileType(content)).toBeNull();
  });
});

describe("errorReportText", () => {
  it("trims, keeps line breaks and drops control characters", () => {
    expect(errorReportText("  a\r\nb\u0000\u0007\tc  ", 50, true)).toBe(
      "a\nb\tc"
    );
  });

  it.each([undefined, null, "", "   "])(
    "refuses the required value %p",
    value => {
      expect(() => errorReportText(value, 50, true)).toThrow(
        expect.objectContaining({ message: "ERR_ERROR_REPORT_INVALID" })
      );
    }
  );

  it("accepts an empty optional value and refuses other types", () => {
    expect(errorReportText(undefined, 50, false)).toBe("");
    expect(() => errorReportText({ a: 1 }, 50, false)).toThrow(
      expect.objectContaining({ message: "ERR_ERROR_REPORT_INVALID" })
    );
  });

  it("refuses a text over the limit", () => {
    expect(() =>
      errorReportText(
        "x".repeat(ERROR_REPORT_TITLE_MAX + 1),
        ERROR_REPORT_TITLE_MAX,
        true
      )
    ).toThrow(expect.objectContaining({ message: "ERR_ERROR_REPORT_INVALID" }));
  });
});

describe("errorReportMail", () => {
  const report = {
    id: 12,
    title: "Tela <b>trava</b>\nao enviar",
    location: "Atendimentos",
    description: "Cliquei em enviar & nada.\n<script>alert(1)</script>",
    companyId: 2,
    companyName: "Empresa Modelo",
    userId: 7,
    userName: "Ana",
    userEmail: "ana@example.invalid",
    userProfile: "user",
    userAgent: "Mozilla/5.0",
    screen: "1366x768",
    appUrl: "https://superchat.example.invalid/tickets",
    createdAt: new Date("2026-11-24T18:00:00Z"),
    attachments: [
      { originalName: "print.png", size: 2048 },
      { originalName: "video.mp4", size: 3 * 1024 * 1024 }
    ]
  };

  it("keeps the subject on one line", () => {
    expect(errorReportMail(report).subject).toBe(
      "[SuperChat] Reporte de erro #12: Tela <b>trava</b> ao enviar"
    );
  });

  it("escapes what the user wrote in the HTML body", () => {
    const { html } = errorReportMail(report);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Cliquei em enviar &amp; nada.");
  });

  it("lists who sent it, the company and the attachments", () => {
    const { text } = errorReportMail(report);

    expect(text).toContain("Enviado por: Ana <ana@example.invalid> (id 7)");
    expect(text).toContain("Empresa: Empresa Modelo (id 2)");
    expect(text).toContain("Anexos: print.png (2 KB); video.mp4 (3,0 MB)");
  });

  it("says when a stored attachment was not found", () => {
    const { text } = errorReportMail({
      ...report,
      missingAttachments: ["print.png"]
    });

    expect(text).toContain("Anexos não encontrados no servidor: print.png");
  });
});

describe("mailSettings", () => {
  it("is off while the host or the sender is missing", () => {
    expect(mailSettings({})).toBeNull();
    expect(mailSettings({ SMTP_HOST: "smtp.example.invalid" })).toBeNull();
    expect(mailSettings({ SMTP_USER: "bot@example.invalid" })).toBeNull();
  });

  it("uses the user as sender, port 587 and STARTTLS by default", () => {
    expect(
      mailSettings({
        SMTP_HOST: "smtp.example.invalid",
        SMTP_USER: "bot@example.invalid",
        SMTP_PASS: "secret"
      })
    ).toEqual({
      host: "smtp.example.invalid",
      port: 587,
      secure: false,
      user: "bot@example.invalid",
      pass: "secret",
      from: "bot@example.invalid"
    });
  });

  it("turns TLS on for port 465 and refuses an invalid port", () => {
    const base = {
      SMTP_HOST: "smtp.example.invalid",
      MAIL_FROM: "SuperChat <bot@example.invalid>"
    };

    expect(mailSettings({ ...base, SMTP_PORT: "465" })?.secure).toBe(true);
    expect(mailSettings({ ...base, SMTP_PORT: "abc" })).toBeNull();
  });
});

describe("isEmailAddress", () => {
  it.each(["ana@example.invalid", "a.b+c@sub.example.invalid"])(
    "accepts %p",
    value => expect(isEmailAddress(value)).toBe(true)
  );

  it.each(["", "ana", "ana@", "a b@example.invalid", "<a@b.co>", null, 5])(
    "refuses %p",
    value => expect(isEmailAddress(value)).toBe(false)
  );
});
