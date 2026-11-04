import { Request, Response } from "express";

import CreateService from "../services/QueueOptionService/CreateService";
import ListService from "../services/QueueOptionService/ListService";
import UpdateService from "../services/QueueOptionService/UpdateService";
import ShowService from "../services/QueueOptionService/ShowService";
import DeleteService from "../services/QueueOptionService/DeleteService";

import AuthorizeQueueAdministrationService from "../services/QueueService/AuthorizeQueueAdministrationService";
import { authorizeQueueOption } from "../services/QueueOptionService/AuthorizeQueueOptionService";
import {
  cleanupQueueUploads,
  deleteQueueMedia,
  storeQueueMedia
} from "../services/QueueService/QueueMediaService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  const { queueId, queueOptionId, parentId } = req.query;
  return res.json(
    await ListService({ companyId, queueId, queueOptionId, parentId })
  );
};
export const store = async (req: Request, res: Response): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  return res.status(200).json(await CreateService(req.body, companyId));
};
export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  return res
    .status(200)
    .json(await ShowService(req.params.queueOptionId, companyId));
};
export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  return res
    .status(200)
    .json(await UpdateService(req.params.queueOptionId, req.body, companyId));
};
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  await DeleteService(req.params.queueOptionId, companyId);
  return res.status(200).json({ message: "Option Delected" });
};
export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const companyId = await AuthorizeQueueAdministrationService(req.user);
    const { option } = await authorizeQueueOption(
      req.params.queueOptionId,
      companyId
    );
    await storeQueueMedia(
      option,
      companyId,
      req.files as Express.Multer.File[]
    );
    return res.send({ mensagem: "Arquivo Salvo" });
  } catch (error) {
    await cleanupQueueUploads(req.files as Express.Multer.File[]);
    throw error;
  }
};
export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = await AuthorizeQueueAdministrationService(req.user);
  const { option } = await authorizeQueueOption(
    req.params.queueOptionId,
    companyId
  );
  await deleteQueueMedia(option, companyId);
  return res.send({ mensagem: "Arquivo excluído" });
};
