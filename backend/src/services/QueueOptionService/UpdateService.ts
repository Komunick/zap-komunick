import QueueOption from "../../models/QueueOption";
import ShowService from "./ShowService";
import { authorizedOptionData } from "./AuthorizeQueueOptionService";

interface QueueData {
  queueId?: number;
  title?: string;
  option?: string;
  message?: string;
  parentId?: number;
}

const UpdateService = async (
  queueOptionId: number | string,
  queueOptionData: QueueData,
  companyId: number
): Promise<QueueOption> => {
  const queueOption = await ShowService(queueOptionId, companyId);

  const data = await authorizedOptionData(
    queueOptionData as unknown as Record<string, unknown>,
    companyId,
    queueOption
  );
  await queueOption.update(data);

  return queueOption;
};

export default UpdateService;
