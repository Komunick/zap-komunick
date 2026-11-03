import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import { positiveChatId } from "../../helpers/ChatAuthorization";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import {
  loadChatActor,
  lockChatOwners,
  loadChatSnapshot,
  withChatTransaction
} from "./AuthorizeChatService";
interface Request {
  ownerId: number;
  companyId: number;
  userId: number;
}
const FindOrCreateDirectService = ({ ownerId, companyId, userId }: Request) =>
  withChatTransaction(async transaction => {
    const owner = positiveChatId(ownerId),
      office = positiveChatId(companyId),
      targetId = positiveChatId(userId);
    if (!owner || !office) throw new AppError("ERR_NO_PERMISSION", 403);
    if (!targetId || targetId === owner)
      throw new AppError("ERR_INVALID_CHAT_USER", 400);
    // Serialize just this company/pair before taking User SHARE locks. User
    // UPDATE locks here would deadlock with a member reading the same chat.
    const pairKey = `chat-direct:${office}:${Math.min(owner, targetId)}:${Math.max(owner, targetId)}`;
    await Chat.sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtextextended(:pairKey, 0))",
      { replacements: { pairKey }, transaction }
    );
    const actor = await loadChatActor(
      { userId: owner, companyId: office },
      transaction
    );
    const target = await User.findOne({
      where: { id: targetId, companyId: actor.companyId },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.SHARE
    });
    if (!target) throw new AppError("ERR_NO_USER_FOUND", 404);
    const mine = await ChatUser.findAll({
      where: { userId: actor.userId },
      transaction
    });
    const preliminary = await Chat.findAll({
      where: {
        id: { [Op.in]: mine.map(member => member.chatId) },
        isDirect: true,
        companyId: actor.companyId
      },
      transaction
    });
    const ownerByChat = new Map(
      preliminary.map(chat => [chat.id, chat.ownerId])
    );
    const owners = await lockChatOwners([...ownerByChat.values()], transaction);
    const candidates = await Chat.findAll({
      where: {
        id: {
          [Op.in]: preliminary
            .filter(chat => owners.has(chat.ownerId))
            .map(chat => chat.id)
        },
        isDirect: true,
        companyId: actor.companyId
      },
      transaction,
      lock: transaction.LOCK.SHARE
    });
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate.ownerId !== ownerByChat.get(candidate.id))
        throw new AppError("ERR_NO_CHAT_FOUND", 404);
      await loadChatSnapshot(candidate, transaction);
      if (
        candidate.users.some(member => member.userId === actor.userId) &&
        candidate.users.some(member => member.userId === targetId)
      )
        return { record: candidate, created: false };
    }
    const record = await Chat.create(
      {
        ownerId: actor.userId,
        companyId: actor.companyId,
        title: "",
        isDirect: true
      },
      { transaction }
    );
    await ChatUser.bulkCreate(
      [
        { chatId: record.id, userId: actor.userId },
        { chatId: record.id, userId: targetId }
      ],
      { transaction }
    );
    return {
      record: await loadChatSnapshot(record, transaction),
      created: true
    };
  });
export default FindOrCreateDirectService;
