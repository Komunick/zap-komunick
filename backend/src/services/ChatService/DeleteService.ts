import AuthorizeChatService, {
  ChatActor,
  withChatTransaction
} from "./AuthorizeChatService";

const DeleteService = async (id: unknown, actor: ChatActor) =>
  withChatTransaction(async transaction => {
    const record = await AuthorizeChatService(id, actor, {
      transaction,
      manage: true,
      write: true
    });
    const snapshot = record.toJSON() as typeof record;
    await record.destroy({ transaction });
    return snapshot;
  });
export default DeleteService;
