import AuthorizeChatService, {
  ChatActor,
  withChatTransaction
} from "./AuthorizeChatService";
const ShowFromUuidService = (uuid: string, actor: ChatActor) =>
  withChatTransaction(transaction =>
    AuthorizeChatService(uuid, actor, { byUuid: true, transaction })
  );
export default ShowFromUuidService;
