import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Queue from "../../models/Queue";
import SlaAlertConfiguration, {
  SlaQueueRecipients
} from "../../models/SlaAlertConfiguration";
import User from "../../models/User";
import UserQueue from "../../models/UserQueue";

export const SLA_ALERT_THRESHOLD_MINUTES = 180;

interface AlertConfig {
  enabled: boolean;
  extraRecipientIds: number[];
  queues: SlaQueueRecipients[];
}

const validId = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2147483647;

const invalidConfig = () => new AppError("ERR_INVALID_SLA_ALERT_CONFIG", 400);
const invalidRecipient = () =>
  new AppError("ERR_INVALID_SLA_ALERT_RECIPIENT", 400);

const parseIds = (values: unknown): number[] => {
  if (!Array.isArray(values) || !values.every(validId)) throw invalidConfig();
  return [...new Set(values)];
};

export function normalizeSlaAlertConfiguration(input: unknown): AlertConfig {
  if (!input || typeof input !== "object") throw invalidConfig();
  const { enabled, extraRecipientIds, queues } = input as AlertConfig;
  if (typeof enabled !== "boolean" || !Array.isArray(queues)) {
    throw invalidConfig();
  }
  const recipients = parseIds(extraRecipientIds);
  const seen = new Set<number>();
  const mappedQueues = queues.map(queue => {
    if (!queue || !validId(queue.queueId) || seen.has(queue.queueId)) {
      throw invalidConfig();
    }
    seen.add(queue.queueId);
    return {
      queueId: queue.queueId,
      responsibleIds: parseIds(queue.responsibleIds)
    };
  });
  if (
    enabled &&
    !recipients.length &&
    !mappedQueues.some(queue => queue.responsibleIds.length)
  ) {
    throw invalidConfig();
  }
  return { enabled, extraRecipientIds: recipients, queues: mappedQueues };
}

export async function getSlaAlertConfig(companyId: number) {
  const config = await SlaAlertConfiguration.findByPk(companyId);
  return {
    enabled: config?.enabled ?? false,
    extraRecipientIds: config?.extraRecipientIds ?? [],
    queues: config?.queues ?? [],
    thresholdMinutes: SLA_ALERT_THRESHOLD_MINUTES
  };
}

export async function updateSlaAlertConfig(
  companyId: number,
  actorId: string,
  input: unknown
) {
  const config = normalizeSlaAlertConfiguration(input);
  const queueIds = config.queues.map(queue => queue.queueId);
  const userIds = [
    ...new Set([
      ...config.extraRecipientIds,
      ...config.queues.flatMap(queue => queue.responsibleIds)
    ])
  ];
  await SlaAlertConfiguration.sequelize.transaction(async transaction => {
    const company = await Company.findByPk(companyId, {
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!company) throw new AppError("ERR_NO_PERMISSION", 403);
    const actor = await User.findOne({
      where: { id: actorId, companyId, profile: "admin" },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.SHARE
    });
    if (!actor) throw new AppError("ERR_NO_PERMISSION", 403);

    const queueCount = await Queue.count({
      where: { id: queueIds, companyId },
      transaction
    });
    const users = await User.findAll({
      where: { id: userIds, companyId },
      attributes: ["id", "profile"],
      transaction
    });
    const memberships = await UserQueue.findAll({
      where: { userId: userIds, queueId: queueIds },
      attributes: ["userId", "queueId"],
      transaction
    });
    if (queueCount !== queueIds.length || users.length !== userIds.length) {
      throw invalidRecipient();
    }
    const generalAdmins = new Set(
      users.filter(user => user.profile === "admin").map(user => user.id)
    );
    const links = new Set(
      memberships.map(link => `${link.queueId}:${link.userId}`)
    );
    if (
      config.queues.some(queue =>
        queue.responsibleIds.some(
          userId =>
            !generalAdmins.has(userId) &&
            !links.has(`${queue.queueId}:${userId}`)
        )
      )
    ) {
      throw invalidRecipient();
    }
    await SlaAlertConfiguration.upsert(
      { companyId, ...config },
      { transaction }
    );
  });
  return { ...config, thresholdMinutes: SLA_ALERT_THRESHOLD_MINUTES };
}
