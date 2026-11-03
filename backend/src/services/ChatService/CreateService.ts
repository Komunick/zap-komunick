import AppError from "../../errors/AppError";
import {
  chatParticipantIds,
  validChatTitle
} from "../../helpers/ChatAuthorization";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import {
  loadChatActor,
  loadChatSnapshot,
  validateChatParticipants,
  withChatTransaction
} from "./AuthorizeChatService";

interface Data {
  ownerId: number;
  companyId: number;
  users: unknown;
  title: unknown;
}

// Zap Komunick: validate every participant before creating any group row.
const CreateService = async ({
  ownerId,
  companyId,
  users,
  title
}: Data): Promise<Chat> =>
  withChatTransaction(async transaction => {
    const actor = await loadChatActor(
      { userId: ownerId, companyId },
      transaction
    );
    const ids = chatParticipantIds(users, actor.userId);
    if (!ids) throw new AppError("ERR_INVALID_CHAT_USER", 400);
    if (!validChatTitle(title))
      throw new AppError("ERR_INVALID_CHAT_TITLE", 400);
    await validateChatParticipants(ids, actor.companyId, transaction);
    const record = await Chat.create(
      { ownerId: actor.userId, companyId: actor.companyId, title },
      { transaction }
    );
    await ChatUser.bulkCreate(
      ids.map(userId => ({ chatId: record.id, userId })),
      { transaction }
    );
    return loadChatSnapshot(record, transaction);
  });
export default CreateService;
