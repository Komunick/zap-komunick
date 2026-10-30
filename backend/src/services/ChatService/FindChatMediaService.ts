import AppError from "../../errors/AppError";
import path from "path";
import { constants, promises as fs } from "fs";
import { positiveChatId } from "../../helpers/ChatAuthorization";
import {
  chatMediaBasename,
  CHAT_MEDIA_SIGNATURE_BYTES,
  detectedChatMediaMime
} from "../../helpers/ChatMediaRules";
import { safeAttachmentName } from "../../helpers/AttachmentRules";
import ChatMessage from "../../models/ChatMessage";
import AuthorizeChatService, {
  ChatActor,
  withChatTransaction
} from "./AuthorizeChatService";
import { resolveChatMediaFile } from "../../config/chatMedia";

export default function FindChatMediaService(
  chatId: unknown,
  messageId: unknown,
  actor: ChatActor
): Promise<{ filePath: string; mediaName: string; mimeType: string | null }> {
  return withChatTransaction(async transaction => {
    const chat = await AuthorizeChatService(chatId, actor, { transaction });
    const id = positiveChatId(messageId);
    if (!id) throw new AppError("ERR_NO_CHAT_FOUND", 404);
    const message = await ChatMessage.findOne({
      where: { id, chatId: chat.id },
      attributes: ["id", "chatId", "mediaPath", "mediaName", "mediaType"],
      transaction
    });
    const basename =
      message && chatMediaBasename(message.getDataValue("mediaPath"));
    if (!basename) throw new AppError("ERR_NO_CHAT_FOUND", 404);
    const filePath = await resolveChatMediaFile(basename);
    const name = message.mediaName;
    const extension = path.extname(basename);
    const handle = await fs.open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    let mimeType: string | null;
    try {
      const prefix = new Uint8Array(CHAT_MEDIA_SIGNATURE_BYTES);
      const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
      mimeType = detectedChatMediaMime(
        prefix.subarray(0, bytesRead),
        basename,
        message.mediaType
      );
    } finally {
      await handle.close();
    }
    return {
      filePath,
      mimeType,
      mediaName: safeAttachmentName(
        typeof name === "string" && name
          ? name
          : `attachment${/^\.[a-zA-Z0-9]{1,32}$/.test(extension) ? extension : ""}`
      )
    };
  });
}
