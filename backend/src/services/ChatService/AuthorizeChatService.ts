import { Op, Transaction } from "sequelize";
import { validate as validUuid } from "uuid";
import AppError from "../../errors/AppError";
import {
  ChatActor,
  chatAccessError,
  positiveChatId
} from "../../helpers/ChatAuthorization";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

export { ChatActor } from "../../helpers/ChatAuthorization";

export const withChatTransaction = <T>(
  work: (transaction: Transaction) => Promise<T>
): Promise<T> => Chat.sequelize.transaction(work);

export async function loadChatActor(
  actor: ChatActor,
  transaction?: Transaction
): Promise<{ userId: number; companyId: number }> {
  const userId = positiveChatId(actor.userId);
  const companyId = positiveChatId(actor.companyId);
  if (!userId || !companyId) throw new AppError("ERR_NO_PERMISSION", 403);
  const user = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id", "companyId"],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });
  if (!user || user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return { userId, companyId };
}

// User deletion locks the owner before its FK cascade locks Chats. Match that
// order before taking a Chat lock; only the FK identity is loaded, never a
// foreign owner's profile. Metadata remains company-scoped below.
export async function lockChatOwners(
  ownerIds: number[],
  transaction: Transaction
): Promise<Set<number>> {
  const ids = [...new Set(ownerIds)].sort((a, b) => a - b);
  const owners = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id"],
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.SHARE
  });
  return new Set(owners.map(owner => owner.id));
}

// No broad User include may escape through chat JSON or socket payloads.
export async function loadChatSnapshot(
  record: Chat,
  transaction?: Transaction
): Promise<Chat> {
  const memberships = await ChatUser.findAll({
    where: { chatId: record.id },
    ...(transaction ? { transaction } : {})
  });
  const users = await User.findAll({
    where: {
      id: {
        [Op.in]: [
          ...new Set([record.ownerId, ...memberships.map(m => m.userId)])
        ]
      },
      companyId: record.companyId
    },
    attributes: ["id", "name"],
    order: [["id", "ASC"]],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });
  const people = new Map(
    users.map(user => [user.id, { id: user.id, name: user.name } as User])
  );
  const scoped = memberships.filter(member => people.has(member.userId));
  // These queries have no include. setDataValue alone does not hydrate the
  // association properties that services read on real Sequelize instances.
  scoped.forEach(member => {
    member.user = people.get(member.userId);
    member.setDataValue("user", member.user);
  });
  record.users = scoped;
  record.owner = people.get(record.ownerId) || null;
  record.setDataValue("users", scoped);
  record.setDataValue("owner", record.owner);
  return record;
}

export async function validateChatParticipants(
  ids: number[],
  companyId: number,
  transaction: Transaction
): Promise<void> {
  const users = await User.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["id"],
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.SHARE
  });
  if (users.length !== ids.length)
    throw new AppError("ERR_INVALID_CHAT_USER", 400);
}

export default async function AuthorizeChatService(
  id: unknown,
  actor: ChatActor,
  options: {
    byUuid?: boolean;
    manage?: boolean;
    transaction?: Transaction;
    write?: boolean;
  } = {}
): Promise<Chat> {
  const {
    byUuid = false,
    manage = false,
    transaction,
    write = false
  } = options;
  const viewer = await loadChatActor(actor, transaction);
  const identifier = byUuid
    ? typeof id === "string" && validUuid(id)
      ? id
      : undefined
    : positiveChatId(id);
  if (!identifier) throw new AppError("ERR_NO_CHAT_FOUND", 404);
  const where = {
    [byUuid ? "uuid" : "id"]: identifier,
    companyId: viewer.companyId
  };
  const preliminary = await Chat.findOne({
    where,
    attributes: ["id", "companyId", "ownerId"],
    ...(transaction ? { transaction } : {})
  });
  if (!preliminary) throw new AppError("ERR_NO_CHAT_FOUND", 404);
  const ownerId = preliminary.ownerId,
    chatId = preliminary.id;
  let record = preliminary;
  if (transaction) {
    const owners = await lockChatOwners([ownerId], transaction);
    if (!owners.has(ownerId)) throw new AppError("ERR_NO_CHAT_FOUND", 404);
    record = await Chat.findOne({
      where: { ...where, id: chatId },
      transaction,
      lock: write ? transaction.LOCK.UPDATE : transaction.LOCK.SHARE
    });
    if (!record || record.ownerId !== ownerId)
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
  } else {
    // Upload admission has no transaction/lock held during the stream. It still
    // needs a full record for membership checks, and is reauthorized afterwards.
    record = await Chat.findOne({ where: { ...where, id: chatId } });
    if (!record || record.ownerId !== ownerId)
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }
  await loadChatSnapshot(record, transaction);
  const error = chatAccessError(
    record,
    viewer,
    record.users.map(member => member.userId),
    manage
  );
  if (error)
    throw new AppError(error, error === "ERR_NO_CHAT_FOUND" ? 404 : 403);
  return record;
}
