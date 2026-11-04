import AppError from "../../errors/AppError";
import User from "../../models/User";

interface SecurityActor {
  id: string | number;
  companyId: number;
  profile: string;
  isSuper?: boolean;
}

// Security operations must use the actor's current membership and privileges.
// A token from a previous company/profile must be refreshed before proceeding.
const AuthorizeSecurityActorService = async (
  actor: SecurityActor,
  administrative = false
): Promise<User> => {
  const id = Number(actor.id);
  const companyId = Number(actor.companyId);
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(companyId) ||
    companyId <= 0
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await User.unscoped().findOne({
    where: { id, companyId },
    logging: false
  });
  if (
    !user ||
    user.id !== id ||
    user.companyId !== companyId ||
    user.profile !== actor.profile ||
    !!user.super !== !!actor.isSuper ||
    (administrative && user.profile !== "admin")
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return user;
};

export default AuthorizeSecurityActorService;
