import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import {
  queueEntityId,
  queueOptionFields
} from "../../helpers/QueueAdministrationRules";
import QueueOption from "../../models/QueueOption";
import Queue from "../../models/Queue";
import { authorizeQueue } from "../QueueService/AuthorizeQueueAdministrationService";

const missing = () => new AppError("ERR_QUEUE_NOT_FOUND", 404);

export async function authorizeQueueOption(
  id: unknown,
  companyId: number,
  cache = new Map<number, QueueOption>(),
  queues = new Map<number, Queue>()
): Promise<{ option: QueueOption; queue: Queue; depth: number }> {
  let currentId = queueEntityId(id),
    option: QueueOption,
    queue: Queue;
  const seen = new Set<number>();
  while (currentId) {
    if (seen.has(currentId) || seen.size >= 100) throw missing();
    seen.add(currentId);
    const row = cache.get(currentId) || (await QueueOption.findByPk(currentId));
    if (!row || row.id !== currentId) throw missing();
    cache.set(currentId, row);
    if (!option) option = row;
    if (row.queueId !== null && row.queueId !== undefined) {
      const own =
        queues.get(row.queueId) ||
        (await authorizeQueue(row.queueId, companyId));
      queues.set(own.id, own);
      if (queue && queue.id !== own.id) throw missing();
      queue = own;
    }
    if (row.parentId == null && row.queueId == null) throw missing();
    currentId = row.parentId == null ? 0 : queueEntityId(row.parentId);
  }
  if (!queue) throw missing();
  return { option, queue, depth: seen.size };
}

export async function authorizedOptionData(
  raw: Record<string, unknown>,
  companyId: number,
  existing?: QueueOption
) {
  const data = queueOptionFields(raw);
  const queueId = data.queueId === undefined ? existing?.queueId : data.queueId;
  const parentId =
    data.parentId === undefined ? existing?.parentId : data.parentId;
  let queue: Queue;
  if (queueId != null) queue = await authorizeQueue(queueId, companyId);
  if (parentId != null) {
    const parent = await authorizeQueueOption(parentId, companyId);
    if (parent.depth >= 100) throw new AppError("ERR_BAD_REQUEST", 400);
    if (queue && parent.queue.id !== queue.id) throw missing();
    queue = parent.queue;
    if (existing) {
      const seen = new Set<number>();
      let ancestor: QueueOption = parent.option;
      while (ancestor) {
        if (ancestor.id === existing.id || seen.has(ancestor.id))
          throw new AppError("ERR_BAD_REQUEST", 400);
        seen.add(ancestor.id);
        ancestor =
          ancestor.parentId == null
            ? null
            : (await authorizeQueueOption(ancestor.parentId, companyId)).option;
      }
    }
  }
  if (!queue) throw new AppError("ERR_BAD_REQUEST", 400);
  if (
    existing &&
    (await authorizeQueueOption(existing.id, companyId)).queue.id !== queue.id
  )
    throw new AppError("ERR_BAD_REQUEST", 400);
  const forwardQueueId =
    data.forwardQueueId === undefined
      ? existing?.forwardQueueId
      : data.forwardQueueId;
  if (forwardQueueId != null) await authorizeQueue(forwardQueueId, companyId);
  return data;
}

export async function authorizeOptionDescendants(
  option: QueueOption,
  companyId: number
): Promise<void> {
  const root = (await authorizeQueueOption(option.id, companyId)).queue.id;
  let frontier = [option.id];
  const seen = new Set<number>(frontier);
  while (frontier.length) {
    const children = await QueueOption.findAll({
      where: { parentId: { [Op.in]: frontier } }
    });
    frontier = [];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (
        seen.has(child.id) ||
        (await authorizeQueueOption(child.id, companyId)).queue.id !== root
      )
        throw missing();
      seen.add(child.id);
      frontier.push(child.id);
    }
  }
}
