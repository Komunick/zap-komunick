import { singleLine } from "./ErrorReportRules";

// Zap Komunick: text of the mail that carries an error report (RF-030).
export interface ErrorReportMailData {
  id: number;
  title: string;
  location?: string | null;
  description: string;
  companyId?: number | null;
  companyName?: string | null;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userProfile?: string | null;
  userAgent?: string | null;
  screen?: string | null;
  appUrl?: string | null;
  createdAt: Date;
  attachments: { originalName: string; size: number }[];
  missingAttachments?: string[];
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fileSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const when = (date: Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: process.env.TZ || "America/Sao_Paulo"
  }).format(date);

const orDash = (value?: string | number | null): string =>
  value === undefined || value === null || value === "" ? "-" : `${value}`;

export const errorReportMail = (
  report: ErrorReportMailData
): { subject: string; text: string; html: string } => {
  const sender = report.userEmail
    ? `${orDash(report.userName)} <${report.userEmail}>`
    : orDash(report.userName);
  const rows: [string, string][] = [
    ["Reporte", `#${report.id}`],
    ["Enviado em", when(report.createdAt)],
    ["Enviado por", `${sender} (id ${orDash(report.userId)})`],
    ["Perfil", orDash(report.userProfile)],
    [
      "Empresa",
      `${orDash(report.companyName)} (id ${orDash(report.companyId)})`
    ],
    ["Onde aconteceu", orDash(report.location)],
    ["Endereço", orDash(report.appUrl)],
    ["Tela", orDash(report.screen)],
    ["Navegador", orDash(report.userAgent)],
    [
      "Anexos",
      report.attachments.length
        ? report.attachments
            .map(file => `${file.originalName} (${fileSize(file.size)})`)
            .join("; ")
        : "nenhum"
    ]
  ];
  if (report.missingAttachments?.length)
    rows.push([
      "Anexos não encontrados no servidor",
      report.missingAttachments.join("; ")
    ]);

  const table = rows.map(([label, value]) => [label, singleLine(value)]);
  const subject = `[SuperChat] Reporte de erro #${report.id}: ${singleLine(
    report.title
  )}`;
  const text = [
    singleLine(report.title),
    "",
    report.description,
    "",
    ...table.map(([label, value]) => `${label}: ${value}`)
  ].join("\n");
  const html = [
    `<h2 style="font-family:sans-serif">${escapeHtml(
      singleLine(report.title)
    )}</h2>`,
    `<p style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(
      report.description
    )}</p>`,
    '<table style="font-family:sans-serif;font-size:13px;border-collapse:collapse">',
    ...table.map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${escapeHtml(
          label
        )}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`
    ),
    "</table>"
  ].join("\n");

  return { subject, text, html };
};
