import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateService from "../services/ChatService/CreateService";
import ListService from "../services/ChatService/ListService";
import ShowFromUuidService from "../services/ChatService/ShowFromUuidService";
import DeleteService from "../services/ChatService/DeleteService";
import FindMessages from "../services/ChatService/FindMessages";
import UpdateService from "../services/ChatService/UpdateService";
import FindOrCreateDirectService from "../services/ChatService/FindOrCreateDirectService";
import MarkChatReadService from "../services/ChatService/MarkChatReadService";
import { createChatMessages } from "../services/ChatService/CreateMessageService";
import { removeChatUploadFiles } from "../config/chatUpload";
import { emitChatEvent } from "../services/SocketServices/ChatSocketService";

const actorOf = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});

export const index = async (req: Request, res: Response): Promise<Response> => {
  const result = await ListService({
    ownerId: Number(req.user.id),
    companyId: req.user.companyId,
    pageNumber: req.query.pageNumber as string
  });
  return res.json(result);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const record = await CreateService({
    ownerId: Number(req.user.id),
    companyId: req.user.companyId,
    users: req.body.users,
    title: req.body.title
  });
  await emitChatEvent(getIO(), { kind: "create", chat: record });
  return res.status(200).json(record);
};

export const direct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { record, created } = await FindOrCreateDirectService({
    ownerId: Number(req.user.id),
    companyId: req.user.companyId,
    userId: req.body.userId
  });
  if (created) await emitChatEvent(getIO(), { kind: "create", chat: record });
  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { record, removedUserIds } = await UpdateService({
    id: req.params.id,
    actor: actorOf(req),
    title: req.body.title,
    users: req.body.users
  });
  await emitChatEvent(getIO(), {
    kind: "membership-update",
    chat: record,
    removedUserIds
  });
  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> =>
  res.status(200).json(await ShowFromUuidService(req.params.id, actorOf(req)));

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const snapshot = await DeleteService(req.params.id, actorOf(req));
  await emitChatEvent(getIO(), { kind: "delete", chat: snapshot });
  return res.status(200).json({ message: "Chat deleted" });
};

export const saveMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const files = (req.files as Express.Multer.File[]) || [];
  let result: Awaited<ReturnType<typeof createChatMessages>>;
  try {
    // The stream can outlive membership. Reauthorize under the mutation lock;
    // all rows commit together, or only these request-owned files are removed.
    const messages = files.length
      ? files.map(file => ({
          message: file.originalname,
          mediaPath: file.filename,
          mediaName: file.originalname,
          mediaType: file.mimetype.split("/")[0]
        }))
      : [{ message: req.body.message }];
    result = await createChatMessages(req.params.id, actorOf(req), messages);
  } catch (error) {
    await removeChatUploadFiles(files);
    throw error;
  }
  const newMessage = result.messages[result.messages.length - 1];
  await emitChatEvent(getIO(), {
    kind: "message",
    chat: result.chat,
    newMessage
  });
  return res.json(newMessage);
};

export const checkAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Body userId is deliberately ignored for old clients: only the actor reads.
  const chat = await MarkChatReadService(req.params.id, actorOf(req));
  await emitChatEvent(getIO(), { kind: "read", chat });
  return res.json(chat);
};

export const messages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await FindMessages({
    chatId: req.params.id,
    ownerId: Number(req.user.id),
    companyId: req.user.companyId,
    pageNumber: req.query.pageNumber as string
  });
  return res.json(result);
};
