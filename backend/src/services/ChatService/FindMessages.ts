import { sortBy } from "lodash";
import AppError from "../../errors/AppError";
import { positiveChatId } from "../../helpers/ChatAuthorization";
import ChatMessage from "../../models/ChatMessage";
import User from "../../models/User";
import AuthorizeChatService, {
  withChatTransaction
} from "./AuthorizeChatService";

interface Request {
  chatId: string;
  ownerId: number;
  companyId: number;
  pageNumber?: string;
}
const FindMessages = ({
  chatId,
  ownerId,
  companyId,
  pageNumber = "1"
}: Request) =>
  withChatTransaction(async transaction => {
    const chat = await AuthorizeChatService(
      chatId,
      { userId: ownerId, companyId },
      { transaction }
    );
    const page = positiveChatId(pageNumber);
    if (!page) throw new AppError("ERR_INVALID_CHAT_PAGE", 400);
    const limit = 20,
      offset = limit * (page - 1);
    const { count, rows } = await ChatMessage.findAndCountAll({
      where: { chatId: chat.id },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name"],
          where: { companyId },
          required: false
        }
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      transaction
    });
    return {
      records: sortBy(rows, ["id", "ASC"]),
      count,
      hasMore: count > offset + rows.length
    };
  });
export default FindMessages;
