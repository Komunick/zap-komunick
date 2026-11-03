import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import { WalletBulkRequest } from "../../helpers/WalletBulk";

// Zap Komunick: wallet in bulk (docs/PRD.md, RF-014). Groups never have an
// owner, like in the one-by-one wallet.

interface Response {
  updated: Contact[];
  skippedGroups: number;
}

const SetWalletBulkService = async (
  request: WalletBulkRequest,
  companyId: number
): Promise<Response> => {
  const ownerIds = [
    request.walletUserId,
    request.mode === "transfer" ? request.fromUserId : null
  ].filter(Boolean);
  if (ownerIds.length) {
    const owners = await User.count({
      where: { id: { [Op.in]: ownerIds }, companyId }
    });
    if (owners !== new Set(ownerIds).size) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }
  }

  const scope =
    request.mode === "contacts"
      ? { id: { [Op.in]: request.contactIds } }
      : { walletUserId: request.fromUserId };

  const targets = await Contact.findAll({
    where: { ...scope, companyId },
    attributes: ["id", "isGroup"]
  });
  const ids = targets.filter(c => !c.isGroup).map(c => c.id);
  const skippedGroups = targets.length - ids.length;

  if (ids.length) {
    await Contact.update(
      { walletUserId: request.walletUserId },
      { where: { id: { [Op.in]: ids }, companyId } }
    );
  }

  const updated = ids.length
    ? await Contact.findAll({
        where: { id: { [Op.in]: ids } },
        include: [
          "tags",
          "extraInfo",
          { model: User, as: "walletUser", attributes: ["id", "name"] }
        ]
      })
    : [];

  return { updated, skippedGroups };
};

export default SetWalletBulkService;
