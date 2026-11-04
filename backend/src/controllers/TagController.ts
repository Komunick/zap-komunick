import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/TagServices/CreateService";
import ListService from "../services/TagServices/ListService";
import UpdateService from "../services/TagServices/UpdateService";
import ShowService from "../services/TagServices/ShowService";
import DeleteService from "../services/TagServices/DeleteService";
import SimpleListService from "../services/TagServices/SimpleListService";
import SyncTagService from "../services/TagServices/SyncTagsService";
import Queue from "../models/Queue";
import User from "../models/User";
import { isTagVisible, normalizeQueueIds } from "../helpers/TagScope";

// Zap Komunick: sectors of a tag, only queues of this company (RF-019)
const companyQueueIds = async (
  companyId: number,
  raw: unknown
): Promise<number[] | null | undefined> => {
  if (raw === undefined) return undefined;
  const ids = normalizeQueueIds(raw);
  if (!ids) return null;
  const queues = await Queue.findAll({
    where: { id: ids, companyId },
    attributes: ["id"]
  });
  const valid = queues.map(q => q.id);
  return valid.length ? valid : null;
};

// who is looking at the tags: their sectors, and the ticket's sector when
// tagging a ticket
const tagViewer = async (req: Request) => {
  const user = await User.findByPk(req.user.id, { include: ["queues"] });
  return {
    isAdmin: req.user.profile === "admin",
    queueIds: (user?.queues || []).map(q => q.id),
    ticketQueueId:
      req.query.queueId === undefined
        ? undefined
        : Number(req.query.queueId) || null
  };
};

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
  kanban?: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { tags, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  // Zap Komunick: each sector sees its own tags and the global ones (RF-019)
  const viewer = { ...(await tagViewer(req)), ticketQueueId: undefined };
  const visible = tags.filter(tag => isTagVisible(tag, viewer));

  return res.json({ tags: visible, count: visible.length, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, kanban } = req.body;
  const { companyId } = req.user;

  const tag = await CreateService({
    name,
    color,
    kanban: kanban || null,
    queueIds: await companyQueueIds(companyId, req.body.queueIds),
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("tag", {
    action: "create",
    tag
  });

  return res.status(200).json(tag);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;

  const tag = await ShowService(Number(tagId), req.user.companyId);

  return res.status(200).json(tag);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin" && req.user.profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { tagId } = req.params;
  const { companyId } = req.user;
  const tagData = {
    ...req.body,
    queueIds: await companyQueueIds(companyId, req.body.queueIds)
  };

  const tag = await UpdateService({ tagData, id: Number(tagId), companyId });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("tag", {
    action: "update",
    tag
  });

  return res.status(200).json(tag);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;
  const { companyId } = req.user;

  await DeleteService(Number(tagId), companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("tag", {
    action: "delete",
    tagId
  });

  return res.status(200).json({ message: "Tag deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const tags = await SimpleListService({ searchParam, companyId });

  // Zap Komunick: only the tags of the user's sectors, or of the ticket's
  // sector when tagging a ticket (RF-019)
  const viewer = await tagViewer(req);

  return res.json(tags.filter(tag => isTagVisible(tag, viewer)));
};

export const syncTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body;
  const { companyId } = req.user;

  const tags = await SyncTagService({ ...data, companyId });

  return res.json(tags);
};
