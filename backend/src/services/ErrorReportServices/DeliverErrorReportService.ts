import { promises as fs } from "fs";
import ErrorReport from "../../models/ErrorReport";
import {
  errorReportFilePath,
  removeErrorReportFiles
} from "../../config/errorReportUpload";
import { errorReportMail } from "../../helpers/ErrorReportMail";
import {
  MailAttachment,
  isEmailAddress,
  isMailConfigured,
  sendMail
} from "../../helpers/Mailer";
import { logger } from "../../utils/logger";

export type DeliverResult = "sent" | "skipped" | "failed";

export const errorReportRecipient = (): string | null => {
  const address = (process.env.ERROR_REPORT_EMAIL || "").trim();
  return isEmailAddress(address) ? address : null;
};

// Zap Komunick: sends one stored report by mail (RF-030). The row is claimed
// first ("pending" -> "sending") so the request that created it and the
// periodic retry never send the same report twice.
const DeliverErrorReportService = async (
  reportId: number
): Promise<DeliverResult> => {
  const recipient = errorReportRecipient();
  if (!recipient || !isMailConfigured()) return "skipped";

  const [claimed] = await ErrorReport.update(
    { emailStatus: "sending", emailAttemptedAt: new Date() },
    { where: { id: reportId, emailStatus: "pending" } }
  );
  if (!claimed) return "skipped";

  const report = await ErrorReport.findByPk(reportId);
  if (!report) return "skipped";

  try {
    const checked = await Promise.all(
      (report.attachments || []).map(async file => {
        const filePath = errorReportFilePath(file.storedName);
        try {
          if (!filePath) throw new Error("ERR_ERROR_REPORT_FILE_NAME");
          await fs.access(filePath);
          return { file, filePath };
        } catch {
          return { file, filePath: null };
        }
      })
    );
    const attachments: MailAttachment[] = checked
      .filter(item => item.filePath)
      .map(item => ({
        filename: item.file.originalName,
        path: item.filePath,
        contentType: item.file.mimeType
      }));
    const missing = checked
      .filter(item => !item.filePath)
      .map(item => item.file.originalName);

    const mail = errorReportMail({
      id: report.id,
      title: report.title,
      location: report.location,
      description: report.description,
      companyId: report.companyId,
      companyName: report.companyName,
      userId: report.userId,
      userName: report.userName,
      userEmail: report.userEmail,
      userProfile: report.userProfile,
      userAgent: report.userAgent,
      screen: report.screen,
      appUrl: report.appUrl,
      createdAt: report.createdAt,
      attachments: report.attachments || [],
      missingAttachments: missing
    });

    await sendMail({
      to: recipient,
      ...mail,
      ...(isEmailAddress(report.userEmail)
        ? { replyTo: report.userEmail }
        : {}),
      attachments
    });

    await report.update({
      emailStatus: "sent",
      emailSentAt: new Date(),
      emailError: null
    });
    await removeErrorReportFiles(
      (report.attachments || []).map(file => file.storedName)
    ).catch(error =>
      logger.warn(
        { reportId, message: error?.message },
        "Error report sent, attachments not removed"
      )
    );
    logger.info({ reportId }, "Error report sent by mail");
    return "sent";
  } catch (error) {
    await report.update({
      emailStatus: "pending",
      emailAttempts: report.emailAttempts + 1,
      emailError: `${error?.message || error}`.slice(0, 500)
    });
    logger.error(
      { reportId, message: error?.message },
      "Error report mail failed"
    );
    return "failed";
  }
};

export default DeliverErrorReportService;
