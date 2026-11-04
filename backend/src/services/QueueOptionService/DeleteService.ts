import ShowService from "./ShowService";
import { authorizeOptionDescendants } from "./AuthorizeQueueOptionService";

const DeleteService = async (
  queueOptionId: number | string,
  companyId: number
): Promise<void> => {
  const queueOption = await ShowService(queueOptionId, companyId);
  await authorizeOptionDescendants(queueOption, companyId);

  await queueOption.destroy();
};

export default DeleteService;
