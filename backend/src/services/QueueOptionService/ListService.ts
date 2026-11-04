import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import QueueOption from "../../models/QueueOption";
import Queue from "../../models/Queue";
import { queueEntityId } from "../../helpers/QueueAdministrationRules";
import { authorizeQueue } from "../QueueService/AuthorizeQueueAdministrationService";
import { authorizeQueueOption } from "./AuthorizeQueueOptionService";

interface Filter {
  companyId: number;
  queueId?: unknown;
  queueOptionId?: unknown;
  parentId?: unknown;
}

const ListService = async ({
  companyId,
  queueId,
  queueOptionId,
  parentId
}: Filter): Promise<QueueOption[]> => {
  const selectedQueue =
    queueId === undefined ? undefined : queueEntityId(queueId);
  const selectedOption =
    queueOptionId === undefined ? undefined : queueEntityId(queueOptionId);
  const selectedParent =
    parentId === undefined
      ? undefined
      : parentId === "-1"
        ? -1
        : queueEntityId(parentId);
  if (selectedQueue) await authorizeQueue(selectedQueue, companyId);
  const references = [
    selectedOption,
    selectedParent && selectedParent > 0 ? selectedParent : undefined
  ];
  for (let index = 0; index < references.length; index += 1) {
    const id = references[index];
    if (
      id &&
      selectedQueue &&
      (await authorizeQueueOption(id, companyId)).queue.id !== selectedQueue
    )
      throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
    if (id && !selectedQueue) await authorizeQueueOption(id, companyId);
  }
  const queues = await Queue.findAll({
    where: { companyId, ...(selectedQueue ? { id: selectedQueue } : {}) },
    attributes: ["id"]
  });
  const queueIds = queues.map(queue => queue.id);
  if (!queueIds.length) return [];
  const candidates = await QueueOption.findAll({
    where: { queueId: { [Op.in]: queueIds } },
    order: [["id", "ASC"]]
  });
  const cache = new Map<number, QueueOption>(
    candidates.map(option => [option.id, option])
  );
  let frontier = candidates.map(option => option.id);
  // Legacy children inherit queueId through their parent. Start at this office's
  // queues rather than reading an unscoped option list.
  while (frontier.length) {
    const children = await QueueOption.findAll({
      where: { queueId: null, parentId: { [Op.in]: frontier } }
    });
    frontier = [];
    children.forEach(child => {
      if (!cache.has(child.id)) {
        cache.set(child.id, child);
        candidates.push(child);
        frontier.push(child.id);
      }
    });
  }
  const result: QueueOption[] = [];
  const authorizedQueues = new Map<number, Queue>();
  for (let index = 0; index < candidates.length; index += 1) {
    const option = candidates[index];
    try {
      const authorized = await authorizeQueueOption(
        option.id,
        companyId,
        cache,
        authorizedQueues
      );
      if (selectedQueue && authorized.queue.id !== selectedQueue) continue;
      if (selectedOption && option.id !== selectedOption) continue;
      if (selectedParent === -1 && option.parentId != null) continue;
      if (
        selectedParent &&
        selectedParent > 0 &&
        option.parentId !== selectedParent
      )
        continue;
      result.push(option);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 404) throw error;
    }
  }
  return result.sort((left, right) => left.id - right.id);
};
export default ListService;
