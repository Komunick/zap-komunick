import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

interface Request {
  ownerId: number;
  companyId: number;
  userId: number;
}

interface Response {
  record: Chat;
  created: boolean;
}

const include = [
  {
    model: ChatUser,
    as: "users",
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  },
  { model: User, as: "owner", attributes: ["id", "name"] }
];

// Zap Komunick: the one-to-one conversation between two users of the same
// company. It is created the first time either of them opens it and reused
// afterwards, so each pair of users has a single direct conversation.
const FindOrCreateDirectService = async ({
  ownerId,
  companyId,
  userId
}: Request): Promise<Response> => {
  if (!userId || +userId === ownerId) {
    throw new AppError("ERR_INVALID_CHAT_USER", 400);
  }

  const target = await User.findOne({ where: { id: userId, companyId } });
  if (!target) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const mine = await ChatUser.findAll({ where: { userId: ownerId } });
  const candidates = await Chat.findAll({
    where: {
      id: { [Op.in]: mine.map(chatUser => chatUser.chatId) },
      isDirect: true,
      companyId
    },
    include
  });

  const existing = candidates.find(chat =>
    chat.users.some(chatUser => chatUser.userId === +userId)
  );
  if (existing) {
    return { record: existing, created: false };
  }

  const record = await Chat.create({
    ownerId,
    companyId,
    title: "",
    isDirect: true
  });
  await ChatUser.create({ chatId: record.id, userId: ownerId });
  await ChatUser.create({ chatId: record.id, userId: +userId });
  await record.reload({ include });

  return { record, created: true };
};

export default FindOrCreateDirectService;
