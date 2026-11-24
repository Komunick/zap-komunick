import nodemailer, { Transporter } from "nodemailer";

// Zap Komunick: outgoing mail of the installation, set by the operator in the
// backend environment (deploy/env-backend.example). Nothing is sent while
// SMTP_HOST and the sender are empty.
export interface MailAttachment {
  filename: string;
  path: string;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export const isEmailAddress = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && EMAIL.test(value);

export const mailSettings = (
  env: NodeJS.ProcessEnv = process.env
): MailSettings | null => {
  const host = (env.SMTP_HOST || "").trim();
  const user = (env.SMTP_USER || "").trim();
  const from = (env.MAIL_FROM || user).trim();
  const port = Number(env.SMTP_PORT || 587);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535)
    return null;
  return {
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user,
    pass: env.SMTP_PASS || "",
    from
  };
};

export const isMailConfigured = (): boolean => mailSettings() !== null;

let cached: { key: string; transporter: Transporter } | null = null;

const transporterFor = (settings: MailSettings): Transporter => {
  const key = JSON.stringify(settings);
  if (cached?.key !== key) {
    cached = {
      key,
      transporter: nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        ...(settings.user
          ? { auth: { user: settings.user, pass: settings.pass } }
          : {}),
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 120000
      })
    };
  }
  return cached.transporter;
};

export const sendMail = async (message: MailMessage): Promise<void> => {
  const settings = mailSettings();
  if (!settings) throw new Error("ERR_MAIL_NOT_CONFIGURED");
  await transporterFor(settings).sendMail({
    from: settings.from,
    ...message
  });
};
