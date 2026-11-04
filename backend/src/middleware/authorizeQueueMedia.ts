import { NextFunction, Request, Response } from "express";
import AuthorizeQueueAdministrationService, {
  authorizeQueue
} from "../services/QueueService/AuthorizeQueueAdministrationService";
import { authorizeQueueOption } from "../services/QueueOptionService/AuthorizeQueueOptionService";

export async function authorizeQueueAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  await AuthorizeQueueAdministrationService(req.user);
  next();
}

export const authorizeQueueMedia =
  (option: boolean) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const companyId = await AuthorizeQueueAdministrationService(req.user);
    if (option) await authorizeQueueOption(req.params.queueOptionId, companyId);
    else await authorizeQueue(req.params.queueId, companyId);
    next();
  };
