import ChatUser from "../../models/ChatUser";
import AuthorizeChatService, {
  ChatActor,
  loadChatSnapshot,
  withChatTransaction
} from "./AuthorizeChatService";

export default function MarkChatReadService(id: unknown, actor: ChatActor) {
  return withChatTransaction(async transaction => {
    const record = await AuthorizeChatService(id, actor, {
      transaction,
      write: true
    });
    await ChatUser.update(
      { unreads: 0 },
      {
        where: { chatId: record.id, userId: Number(actor.userId) },
        transaction
      }
    );
    return loadChatSnapshot(record, transaction);
  });
}
