import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";

interface CredentialActor {
  userId: string | number;
  companyId: number;
}

// Zap Komunick: credential administration uses the current actor, not only
// the company/profile in a still-valid token. Internal secret consumers keep
// their existing backend-only service contract.
export async function withCredentialAdmin<T>(
  actor: CredentialActor,
  write: boolean,
  operation: (companyId: number, transaction: Transaction) => Promise<T>
): Promise<T> {
  const userId = Number(actor.userId),
    companyId = Number(actor.companyId);
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(companyId) ||
    companyId <= 0
  )
    throw new AppError("ERR_NO_PERMISSION", 403);
  try {
    return await sequelize.transaction(async transaction => {
      // Match parent-first Company deletion/cascades, then hold the actor's
      // membership/profile until the administrative operation has committed.
      const company = await Company.findByPk(companyId, {
        attributes: ["id"],
        transaction,
        lock: write ? transaction.LOCK.UPDATE : transaction.LOCK.SHARE,
        logging: false
      });
      if (!company) throw new AppError("ERR_NO_PERMISSION", 403);
      const user = await User.findOne({
        where: { id: userId, companyId },
        attributes: ["id", "companyId", "profile"],
        transaction,
        lock: transaction.LOCK.SHARE,
        logging: false
      });
      if (
        !user ||
        user.id !== userId ||
        user.companyId !== companyId ||
        user.profile !== "admin"
      )
        throw new AppError("ERR_NO_PERMISSION", 403);
      return operation(companyId, transaction);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Never allow ORM diagnostics or operation values to reach HTTP/logging.
    throw new AppError("ERR_CREDENTIAL_STORAGE_UNAVAILABLE", 503);
  }
}
