import QueueOption from "../../models/QueueOption";
import { authorizedOptionData } from "./AuthorizeQueueOptionService";

interface QueueOptionData {
  queueId: number;
  title: string;
  option: string;
  message?: string;
  parentId?: number;
}

const CreateService = async (
  queueOptionData: QueueOptionData,
  companyId: number
): Promise<QueueOption> => {
  const data = await authorizedOptionData(
    queueOptionData as unknown as Record<string, unknown>,
    companyId
  );
  const queueOption = await QueueOption.create(data);
  return queueOption;
};

export default CreateService;
