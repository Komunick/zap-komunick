import { CronJob } from "cron";
import { Op } from "sequelize";
import ErrorReport from "../../models/ErrorReport";
import { isMailConfigured } from "../../helpers/Mailer";
import { logger } from "../../utils/logger";
import DeliverErrorReportService, {
  errorReportRecipient
} from "./DeliverErrorReportService";

const MINUTE = 60 * 1000;
// After this many failures in a row the report waits six hours between tries.
const QUICK_ATTEMPTS = 6;
const SLOW_RETRY_MS = 6 * 60 * MINUTE;
// A send that never finished (the process stopped in the middle of it).
const STALE_SENDING_MS = 15 * MINUTE;
const BATCH = 10;

// Zap Komunick: retries the reports whose mail has not gone out yet (RF-030):
// mail not configured when they were created, or a failure of the mail server.
const SendPendingErrorReportsService = async (
  now: Date = new Date()
): Promise<number> => {
  if (!errorReportRecipient() || !isMailConfigured()) return 0;

  await ErrorReport.update(
    { emailStatus: "pending" },
    {
      where: {
        emailStatus: "sending",
        emailAttemptedAt: {
          [Op.lt]: new Date(now.getTime() - STALE_SENDING_MS)
        }
      }
    }
  );

  const pending = await ErrorReport.findAll({
    attributes: ["id"],
    where: {
      emailStatus: "pending",
      [Op.or]: [
        { emailAttempts: { [Op.lt]: QUICK_ATTEMPTS } },
        { emailAttemptedAt: null },
        {
          emailAttemptedAt: { [Op.lt]: new Date(now.getTime() - SLOW_RETRY_MS) }
        }
      ]
    },
    order: [["id", "ASC"]],
    limit: BATCH
  });

  let sent = 0;
  for (let index = 0; index < pending.length; index += 1) {
    // One at a time: each mail can carry up to 15 MB of attachments.
    const result = await DeliverErrorReportService(pending[index].id);
    if (result === "sent") sent += 1;
    // A failure is usually the mail server itself; the rest waits for the
    // next round instead of failing one by one.
    if (result === "failed") break;
  }
  return sent;
};

let running = false;

export const startErrorReportMailer = (): CronJob => {
  const job = new CronJob("0 */10 * * * *", async () => {
    if (running) return;
    running = true;
    try {
      await SendPendingErrorReportsService();
    } catch (error) {
      logger.error(
        { message: error?.message },
        "Pending error reports: retry failed"
      );
    } finally {
      running = false;
    }
  });
  job.start();
  return job;
};

export default SendPendingErrorReportsService;
