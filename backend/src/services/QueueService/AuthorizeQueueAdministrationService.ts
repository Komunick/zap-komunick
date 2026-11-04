import AppError from "../../errors/AppError";
import { queueEntityId } from "../../helpers/QueueAdministrationRules";
import User from "../../models/User";
import Queue from "../../models/Queue";

interface Actor {
  id: string | number;
  companyId: number;
  profile: string;
  isSuper: boolean;
}

// These administration routes operate only in the authenticated company, even
// for a superuser. Managing another office uses its authorized session.
export default async function AuthorizeQueueAdministrationService(
  actor: Actor
): Promise<number> {
  let id: number, companyId: number;
  try {
    id = queueEntityId(actor?.id);
    companyId = queueEntityId(actor?.companyId);
  } catch {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const user = await User.findOne({
    where: { id, companyId },
    attributes: ["id", "companyId", "profile", "super"]
  });
  if (
    !user ||
    user.id !== id ||
    user.companyId !== companyId ||
    user.profile !== "admin" ||
    user.profile !== actor.profile ||
    (user.super === true) !== (actor.isSuper === true)
  )
    throw new AppError("ERR_NO_PERMISSION", 403);
  return companyId;
}

export async function authorizeQueue(
  queueId: unknown,
  companyId: number
): Promise<Queue> {
  const id = queueEntityId(queueId);
  const queue = await Queue.findOne({ where: { id, companyId } });
  if (!queue || queue.id !== id || queue.companyId !== companyId)
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  return queue;
}
