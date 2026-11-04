import AppError from "../../errors/AppError";
import { queueListScope } from "../../helpers/QueueScopeRules";
import User from "../../models/User";

interface QueueListActor {
  id: string | number;
  companyId: number;
  profile: string;
  isSuper: boolean;
}

const AuthorizeQueueListService = async (
  actor: QueueListActor,
  requestedCompanyId: unknown
): Promise<number> => {
  const id = Number(actor?.id);
  const companyId = Number(actor?.companyId);
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(companyId) ||
    companyId <= 0
  ) {
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
    user.profile !== actor.profile ||
    (user.super === true) !== (actor.isSuper === true)
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const scope = queueListScope(
    user.companyId,
    user.super === true,
    requestedCompanyId
  );
  if ("error" in scope) throw new AppError(scope.error, scope.statusCode);
  return scope.companyId;
};

export default AuthorizeQueueListService;
