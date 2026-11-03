import Chat from "../../models/Chat";
import AppError from "../../errors/AppError";

const DeleteService = async (id: string): Promise<void> => {
  const record = await Chat.findOne({
    where: { id }
  });

  if (!record) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  // deleting would erase the history of both people
  if (record.isDirect) {
    throw new AppError("ERR_CHAT_DIRECT_READONLY", 403);
  }

  await record.destroy();
};

export default DeleteService;
