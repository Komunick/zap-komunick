import AppError from "../../errors/AppError";
import ChatMessage from "../../models/ChatMessage";
import User from "../../models/User";
import AuthorizeChatService, {
  ChatActor,
  loadChatSnapshot,
  withChatTransaction
} from "./AuthorizeChatService";

export interface ChatMessageData {
  senderId: number;
  companyId: number;
  chatId: number;
  message: string;
  mediaName?: string;
  mediaPath?: string;
  mediaType?: string;
}
type MessageInput = Omit<ChatMessageData, "senderId" | "companyId" | "chatId">;

// A single request is authorized and committed as one batch. Revocation cannot
// split a multi-upload into persisted and denied messages.
export async function createChatMessages(
  chatId: unknown,
  actor: ChatActor,
  messages: MessageInput[]
) {
  return withChatTransaction(async transaction => {
    const chat = await AuthorizeChatService(chatId, actor, {
      transaction,
      write: true
    });
    if (
      !messages.length ||
      messages.some(
        m =>
          typeof m.message !== "string" || (!m.mediaPath && !m.message.trim())
      )
    ) {
      throw new AppError("ERR_INVALID_CHAT_MESSAGE", 400);
    }
    const senderId = Number(actor.userId);
    const result: ChatMessage[] = [];
    for (let index = 0; index < messages.length; index += 1) {
      const input = messages[index];
      const row = await ChatMessage.create(
        {
          ...input,
          senderId,
          chatId: chat.id,
          mediaType: input.mediaType || "text"
        },
        { transaction }
      );
      await row.reload({
        include: [{ model: User, as: "sender", attributes: ["id", "name"] }],
        transaction
      });
      row.setDataValue("sender", {
        id: row.sender.id,
        name: row.sender.name
      } as User);
      result.push(row);
    }
    const last = messages[messages.length - 1];
    const sender = chat.users.find(member => member.userId === senderId).user;
    await chat.update(
      {
        lastMessage: `${sender.name}: ${last.mediaName != null ? last.mediaName : last.message}`
      },
      { transaction }
    );
    for (let index = 0; index < chat.users.length; index += 1) {
      const member = chat.users[index];
      await member.update(
        {
          unreads:
            member.userId === senderId
              ? 0
              : (member.unreads || 0) + messages.length
        },
        { transaction }
      );
    }
    await loadChatSnapshot(chat, transaction);
    result.forEach(row => row.setDataValue("chat", chat));
    return { chat, messages: result };
  });
}
export default async function CreateMessageService({
  senderId,
  companyId,
  chatId,
  ...message
}: ChatMessageData) {
  const result = await createChatMessages(
    chatId,
    { userId: senderId, companyId },
    [message]
  );
  return result.messages[0];
}
