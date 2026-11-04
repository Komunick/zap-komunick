import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import {
  chatAccessError,
  positiveChatId
} from "../../helpers/ChatAuthorization";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import {
  loadChatActor,
  lockChatOwners,
  loadChatSnapshot,
  withChatTransaction
} from "./AuthorizeChatService";
interface Request {
  ownerId: number;
  companyId: number;
  pageNumber?: string;
}
const ListService = ({ ownerId, companyId, pageNumber = "1" }: Request) =>
  withChatTransaction(async transaction => {
    const actor = await loadChatActor(
      { userId: ownerId, companyId },
      transaction
    );
    const page = positiveChatId(pageNumber);
    if (!page) throw new AppError("ERR_INVALID_CHAT_PAGE", 400);
    const mine = await ChatUser.findAll({
      where: { userId: actor.userId },
      transaction
    });
    const limit = 20,
      offset = limit * (page - 1);
    const preliminary = await Chat.findAll({
      where: {
        id: { [Op.in]: mine.map(member => member.chatId) },
        companyId: actor.companyId
      },
      limit,
      offset,
      order: [["updatedAt", "DESC"]],
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
        companyId: actor.companyId
      },
      order: [["updatedAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.SHARE
    });
    const records: Chat[] = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const record = candidates[index];
      if (record.ownerId !== ownerByChat.get(record.id)) continue;
      await loadChatSnapshot(record, transaction);
      if (
        !chatAccessError(
          record,
          actor,
          record.users.map(member => member.userId)
        )
      )
        records.push(record);
    }
    const count = await Chat.count({
      where: { companyId: actor.companyId },
      include: [
        {
          model: ChatUser,
          as: "users",
          where: { userId: actor.userId },
          attributes: [],
          required: true
        }
      ],
      distinct: true,
      transaction
    });
    return { records, count, hasMore: count > offset + records.length };
  });
export default ListService;
