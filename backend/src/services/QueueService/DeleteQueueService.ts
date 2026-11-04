import { authorizeQueue } from "./AuthorizeQueueAdministrationService";
import QueueOption from "../../models/QueueOption";
import { authorizeOptionDescendants } from "../QueueOptionService/AuthorizeQueueOptionService";

const DeleteQueueService = async (
  queueId: number | string,
  companyId: number
): Promise<void> => {
  const queue = await authorizeQueue(queueId, companyId);
  // Both queueId and parentId cascade in PostgreSQL. Validate every branch
  // before deleting, including old rows linked to another company's parent.
  const options = await QueueOption.findAll({ where: { queueId: queue.id } });
  for (let index = 0; index < options.length; index += 1)
    await authorizeOptionDescendants(options[index], companyId);

  await queue.destroy();
};

export default DeleteQueueService;
