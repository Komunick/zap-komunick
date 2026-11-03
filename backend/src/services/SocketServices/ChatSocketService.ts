import { Server } from "socket.io";
import { Op, Transaction } from "sequelize";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import { logger } from "../../utils/logger";
import { chatMediaUrl } from "../../helpers/ChatMediaRules";

export interface ChatSocketSnapshot {
  id: number;
  companyId: number;
  users: { userId: number }[];
}

interface ChatMessageSnapshot {
  id: number;
  chatId: number;
  senderId: number;
  message: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  mediaPath?: string;
  mediaName?: string;
  mediaType?: string;
}

export interface ChatSocketEvent {
  kind: "create" | "membership-update" | "delete" | "message" | "read";
  chat: ChatSocketSnapshot;
  newMessage?: ChatMessageSnapshot;
  removedUserIds?: number[];
}

const positiveIds = (ids: number[]) =>
  [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0);

const safeUser = (user: User | undefined) =>
  user ? { id: user.id, name: user.name } : null;

// Zap Komunick: rooms identify candidates, never permission. A read transaction
// serializes membership changes and company moves until the synchronous emits.
// The caller invokes this only after its write transaction has committed.
export async function emitChatEvent(
  io: Server,
  event: ChatSocketEvent
): Promise<void> {
  try {
    const { id, companyId } = event.chat;
    if (!positiveIds([id]).length || !positiveIds([companyId]).length) return;
    if (
      event.kind === "message" &&
      (!event.newMessage || event.newMessage.chatId !== id)
    )
      return;

    await Chat.sequelize.transaction(async transaction => {
      let expectedOwnerId: number;
      if (event.kind !== "delete") {
        const candidate = await Chat.findOne({
          where: { id, companyId },
          attributes: ["id", "companyId", "ownerId"],
          transaction
        });
        if (!candidate || candidate.companyId !== companyId) return;
        expectedOwnerId = candidate.ownerId;
        // Owner deletion cascades into Chats. Lock that FK parent first,
        // including a legacy foreign owner, without reading their profile.
        const owner = await User.findByPk(expectedOwnerId, {
          attributes: ["id"],
          transaction,
          lock: Transaction.LOCK.SHARE
        });
        if (!owner) return;
      }
      const current = await Chat.findOne({
        where: { id, companyId },
        attributes: [
          "id",
          "companyId",
          "uuid",
          "title",
          "ownerId",
          "lastMessage",
          "isDirect",
          "createdAt",
          "updatedAt"
        ],
        transaction,
        lock: Transaction.LOCK.UPDATE
      });
      if (event.kind === "delete" ? current !== null : current === null) return;
      if (current && current.companyId !== companyId) return;
      if (current && current.ownerId !== expectedOwnerId) return;

      const memberships = current
        ? await ChatUser.findAll({
            where: { chatId: id },
            attributes: ["id", "chatId", "userId", "unreads"],
            order: [["userId", "ASC"]],
            transaction
          })
        : [];
      const removed = positiveIds(event.removedUserIds || []);
      const candidates = positiveIds(
        current
          ? [...memberships.map(member => member.userId), ...removed]
          : event.chat.users.map(member => member.userId)
      );
      if (!candidates.length) return;
      const sockets = await io
        .in(candidates.map(userId => `user-${userId}`))
        .fetchSockets();
      const userIds = positiveIds([
        ...candidates,
        ...(current ? [current.ownerId] : []),
        ...(event.newMessage ? [event.newMessage.senderId] : [])
      ]);
      const people = await User.findAll({
        where: { id: { [Op.in]: userIds }, companyId },
        attributes: ["id", "name", "companyId"],
        order: [["id", "ASC"]],
        transaction,
        lock: Transaction.LOCK.SHARE
      });
      const users = new Map(
        people
          .filter(person => person.companyId === companyId)
          .map(person => [person.id, person])
      );
      const currentMembers = new Set(
        memberships
          .filter(member => users.has(member.userId))
          .map(member => member.userId)
      );
      const removedMembers = new Set(removed);
      const payloadChat = current && {
        id: current.id,
        companyId: current.companyId,
        uuid: current.uuid,
        title: current.title,
        ownerId: current.ownerId,
        lastMessage: current.lastMessage,
        isDirect: current.isDirect,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
        owner: safeUser(users.get(current.ownerId)),
        users: memberships
          .filter(member => users.has(member.userId))
          .map(member => ({
            id: member.id,
            chatId: member.chatId,
            userId: member.userId,
            unreads: member.unreads,
            user: safeUser(users.get(member.userId))
          }))
      };
      const message = event.newMessage;
      const payloadMessage = message && {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        message: message.message,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        mediaPath: message.mediaPath
          ? chatMediaUrl(
              message.chatId,
              message.id,
              process.env.BACKEND_URL || ""
            )
          : null,
        mediaName: message.mediaName,
        mediaType: message.mediaType,
        sender: safeUser(users.get(message.senderId))
      };

      // No await after the final current-user lookup: all recipient decisions
      // and emits run while the Chat and User locks are still held.
      sockets.forEach(socket => {
        const actor = socket.data.contextActor;
        const userId = Number(actor?.userId);
        if (
          actor?.companyId !== companyId ||
          !users.has(userId) ||
          !candidates.includes(userId)
        )
          return;
        if (
          event.kind === "delete" ||
          (!currentMembers.has(userId) && removedMembers.has(userId))
        ) {
          socket.emit(`company-${companyId}-chat`, { action: "delete", id });
          return;
        }
        if (!currentMembers.has(userId)) return;
        if (event.kind === "create" || event.kind === "membership-update") {
          socket.emit(`company-${companyId}-chat-user-${userId}`, {
            action: event.kind === "create" ? "create" : "update",
            record: payloadChat
          });
          return;
        }
        const payload =
          event.kind === "message"
            ? {
                action: "new-message",
                newMessage: payloadMessage,
                chat: payloadChat
              }
            : { action: "update", chat: payloadChat };
        socket.emit(`company-${companyId}-chat`, payload);
        socket.emit(`company-${companyId}-chat-${id}`, payload);
      });
    });
  } catch {
    // Delivery failure must neither expose a snapshot nor turn a committed
    // message into an apparent failed send that a person could duplicate.
    logger.warn(
      "Internal chat event withheld because authorization was unavailable"
    );
  }
}
