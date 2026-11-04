import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import {
  chatParticipantIds,
  validChatTitle
} from "../../helpers/ChatAuthorization";
import ChatUser from "../../models/ChatUser";
import AuthorizeChatService, {
  ChatActor,
  loadChatSnapshot,
  validateChatParticipants,
  withChatTransaction
} from "./AuthorizeChatService";

interface ChatData {
  id: unknown;
  actor: ChatActor;
  title?: unknown;
  users?: unknown;
}

export default async function UpdateService({
  id,
  actor,
  title,
  users
}: ChatData) {
  return withChatTransaction(async transaction => {
    const record = await AuthorizeChatService(id, actor, {
      transaction,
      manage: true,
      write: true
    });
    const before = record.users.map(member => member.userId);
    const ids =
      users === undefined
        ? undefined
        : chatParticipantIds(users, record.ownerId);
    if (users !== undefined && !ids)
      throw new AppError("ERR_INVALID_CHAT_USER", 400);
    let nextTitle: string | undefined;
    if (title !== undefined) {
      if (!validChatTitle(title))
        throw new AppError("ERR_INVALID_CHAT_TITLE", 400);
      nextTitle = title;
    }
    if (ids) await validateChatParticipants(ids, record.companyId, transaction);
    if (nextTitle !== undefined)
      await record.update({ title: nextTitle }, { transaction });
    if (ids) {
      await ChatUser.destroy({
        where: { chatId: record.id, userId: { [Op.notIn]: ids } },
        transaction
      });
      const added = ids.filter(userId => !before.includes(userId));
      if (added.length)
        await ChatUser.bulkCreate(
          added.map(userId => ({ chatId: record.id, userId, unreads: 0 })),
          { transaction }
        );
    }
    await loadChatSnapshot(record, transaction);
    return {
      record,
      removedUserIds: ids ? before.filter(userId => !ids.includes(userId)) : []
    };
  });
}
