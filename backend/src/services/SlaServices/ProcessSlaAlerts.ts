import { QueryTypes } from "sequelize";
import SlaAlertConfiguration from "../../models/SlaAlertConfiguration";
import { logger } from "../../utils/logger";
import { SLA_ALERT_THRESHOLD_MINUTES } from "./SlaAlertConfigurationService";

interface ProcessOptions {
  companyId?: number;
  now?: Date;
}

const processSlaAlerts = async ({
  companyId,
  now = new Date()
}: ProcessOptions = {}): Promise<number> => {
  const configs = await SlaAlertConfiguration.findAll({
    where: { enabled: true, ...(companyId !== undefined && { companyId }) },
    attributes: ["companyId"]
  });
  const cutoff = new Date(now.getTime() - SLA_ALERT_THRESHOLD_MINUTES * 60000);
  let inserted = 0;
  let failed = false;

  // eslint-disable-next-line no-restricted-syntax
  for (const config of configs) {
    try {
      // Use a single snapshot for current configuration, ticket and membership.
      // The unique index arbitrates retries or overlapping worker runs.
      const [result] = await SlaAlertConfiguration.sequelize.query<{
        count: number;
      }>(
        `
          WITH config AS (
            SELECT "companyId", "extraRecipientIds", queues
            FROM "SlaAlertConfigurations"
            WHERE "companyId" = $companyId AND enabled
          ),
          configured_responsibles AS (
            SELECT (mapping->>'queueId')::integer AS "queueId",
                   responsible::integer AS "recipientId"
            FROM config,
              jsonb_array_elements(config.queues) mapping,
              jsonb_array_elements_text(mapping->'responsibleIds') responsible
          ),
          extra_recipients AS (
            SELECT recipient::integer AS "recipientId"
            FROM config, jsonb_array_elements_text(config."extraRecipientIds") recipient
          ),
          eligible AS (
            SELECT t.id, t."companyId", t."unansweredSince", t."queueId"
            FROM "Tickets" t
            JOIN config c ON t."companyId" = c."companyId"
            JOIN "Queues" q ON q.id = t."queueId" AND q."companyId" = t."companyId"
            WHERE t.status IN ('open', 'pending') AND t.chatbot IS NOT TRUE
              AND t."unansweredSince" <= $cutoff
          ),
          notifications AS (
            SELECT t.id, t."companyId", t."unansweredSince", u.id AS "recipientId"
            FROM eligible t
            JOIN configured_responsibles r ON r."queueId" = t."queueId"
            JOIN "Users" u ON u.id = r."recipientId" AND u."companyId" = t."companyId"
            WHERE u.profile = 'admin' OR EXISTS (
              SELECT 1 FROM "UserQueues" uq
              WHERE uq."userId" = u.id AND uq."queueId" = t."queueId"
            )
            UNION
            SELECT t.id, t."companyId", t."unansweredSince", u.id AS "recipientId"
            FROM eligible t CROSS JOIN extra_recipients e
            JOIN "Users" u ON u.id = e."recipientId" AND u."companyId" = t."companyId"
          ),
          inserted AS (
            INSERT INTO "SlaAlerts"
              ("ticketId", "companyId", "unansweredSince", "recipientId", "createdAt")
            SELECT n.id, n."companyId", n."unansweredSince", n."recipientId", $now
            FROM notifications n
            WHERE NOT EXISTS (
              SELECT 1 FROM "SlaAlerts" a
              WHERE a."ticketId" = n.id AND a."recipientId" = n."recipientId"
                AND a."unansweredSince" = n."unansweredSince"
            )
            ON CONFLICT ("ticketId", "recipientId", "unansweredSince") DO NOTHING
            RETURNING id
          )
          SELECT COUNT(*)::integer AS count FROM inserted
        `,
        {
          type: QueryTypes.SELECT,
          bind: { companyId: config.companyId, cutoff, now },
          logging: false
        }
      );
      inserted += result.count;
    } catch {
      failed = true;
      logger.error({ companyId: config.companyId }, "SLA alert scan failed");
    }
  }
  if (failed) throw new Error("SLA alert scan failed");
  return inserted;
};

export default processSlaAlerts;
