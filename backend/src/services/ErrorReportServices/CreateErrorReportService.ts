import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import ErrorReport, { ErrorReportAttachment } from "../../models/ErrorReport";
import User from "../../models/User";
import {
  ERROR_REPORT_DESCRIPTION_MAX,
  ERROR_REPORT_LOCATION_MAX,
  ERROR_REPORT_MAX_PER_HOUR,
  ERROR_REPORT_TITLE_MAX,
  errorReportText
} from "../../helpers/ErrorReportRules";

interface Request {
  userId: number;
  companyId: number;
  title: unknown;
  location?: unknown;
  description: unknown;
  screen?: unknown;
  appUrl?: unknown;
  userAgent?: unknown;
  attachments: ErrorReportAttachment[];
}

// Zap Komunick: stores the report before any mail is tried, so nothing is
// lost while the mail server is down or not configured yet (RF-030).
const CreateErrorReportService = async ({
  userId,
  companyId,
  title,
  location,
  description,
  screen,
  appUrl,
  userAgent,
  attachments
}: Request): Promise<ErrorReport> => {
  const fields = {
    title: errorReportText(title, ERROR_REPORT_TITLE_MAX, true),
    location: errorReportText(location, ERROR_REPORT_LOCATION_MAX, false),
    description: errorReportText(
      description,
      ERROR_REPORT_DESCRIPTION_MAX,
      true
    ),
    screen: errorReportText(screen, 40, false),
    appUrl: errorReportText(appUrl, 255, false),
    userAgent:
      typeof userAgent === "string"
        ? errorReportText(userAgent.slice(0, 500), 500, false)
        : ""
  };

  const recent = await ErrorReport.count({
    where: {
      userId,
      createdAt: { [Op.gt]: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
  if (recent >= ERROR_REPORT_MAX_PER_HOUR)
    throw new AppError("ERR_ERROR_REPORT_RATE_LIMIT", 429);

  const user = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id", "name", "email", "profile"]
  });
  if (!user) throw new AppError("ERR_NO_PERMISSION", 403);
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "name"]
  });

  return ErrorReport.create({
    companyId,
    userId,
    companyName: company?.name || null,
    userName: user.name,
    userEmail: user.email,
    userProfile: user.profile,
    title: fields.title,
    location: fields.location || null,
    description: fields.description,
    screen: fields.screen || null,
    appUrl: fields.appUrl || null,
    userAgent: fields.userAgent || null,
    attachments,
    emailStatus: "pending",
    emailAttempts: 0
  } as ErrorReport);
};

export default CreateErrorReportService;
