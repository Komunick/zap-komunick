import { Op, WhereOptions } from "sequelize";
import {
  GENERAL_TRIAGE_QUEUE,
  readGeneralTriageQueueId,
  readGeneralTriageTimeout
} from "../../helpers/GeneralTriage";
import Queue from "../../models/Queue";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { assignGeneralTriageDestination } from "./GeneralTriageRouting";

const findLinkedChannels = async (companyId: number, queueId: number) =>
  Whatsapp.findAll({
    attributes: ["id"],
    where: { companyId, channel: "whatsapp" },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: [],
        where: { id: queueId, companyId },
        through: { attributes: [] },
        required: true
      }
    ]
  });

export const generalTriageLegacyExclusion = async (
  companyId: number
): Promise<WhereOptions<Ticket>> => {
  const queueId = await readGeneralTriageQueueId(companyId);
  if (!queueId) return {};
  const channels = await findLinkedChannels(companyId, queueId);
  if (!channels.length) return {};
  return {
    [Op.or]: [
      { generalTriageStartedAt: null },
      { channel: { [Op.ne]: "whatsapp" } },
      { isGroup: { [Op.ne]: false } },
      { queueId: { [Op.ne]: null } },
      { userId: { [Op.ne]: null } },
      { whatsappId: { [Op.is]: null } },
      { whatsappId: { [Op.notIn]: channels.map(({ id }) => id) } }
    ]
  };
};

const routeExpiredGeneralTriageTickets = async ({
  companyId,
  now = new Date()
}: { companyId?: number; now?: Date } = {}): Promise<number> => {
  const settings = await Setting.findAll({
    attributes: ["companyId"],
    where: {
      key: GENERAL_TRIAGE_QUEUE,
      value: { [Op.notIn]: ["", "0"] },
      ...(companyId !== undefined && { companyId })
    },
    group: ["companyId"]
  });

  let moved = 0;
  // Run each tenant and ticket in order so the worker does not flood the DB pool.
  // eslint-disable-next-line no-restricted-syntax
  for (const setting of settings) {
    const tenant = setting.companyId;
    try {
      const queueId = await readGeneralTriageQueueId(tenant);
      if (!queueId) continue;
      const channels = await findLinkedChannels(tenant, queueId);
      if (!channels.length) continue;
      const timeout = await readGeneralTriageTimeout(tenant);
      const deadline = new Date(now.getTime() - timeout * 60_000);
      const tickets = await Ticket.findAll({
        attributes: ["id", "companyId", "whatsappId"],
        where: {
          companyId: tenant,
          channel: "whatsapp",
          whatsappId: channels.map(({ id }) => id),
          status: "pending",
          isGroup: false,
          queueId: null,
          userId: null,
          generalTriageStartedAt: { [Op.lte]: deadline }
        },
        order: [
          ["generalTriageStartedAt", "ASC"],
          ["id", "ASC"]
        ],
        limit: 100
      });
      // eslint-disable-next-line no-restricted-syntax
      for (const ticket of tickets) {
        try {
          const routed = await assignGeneralTriageDestination(
            ticket,
            { id: queueId, chatbot: false, isGeneral: true },
            deadline
          );
          if (routed) moved += 1;
        } catch {
          logger.warn(
            { ticketId: ticket.id, companyId: tenant },
            "General triage routing failed"
          );
        }
      }
    } catch {
      logger.warn({ companyId: tenant }, "General triage scan failed");
    }
  }
  return moved;
};

export default routeExpiredGeneralTriageTickets;
