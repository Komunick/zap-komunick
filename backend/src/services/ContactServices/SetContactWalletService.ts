import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import ShowContactService from "./ShowContactService";

// Zap Komunick: sets the user responsible for the contact (docs/PRD.md, RF-003)

interface Request {
  contactId: number | string;
  walletUserId: number | null;
  companyId: number;
}

const SetContactWalletService = async ({
  contactId,
  walletUserId,
  companyId
}: Request): Promise<Contact> => {
  const contact = await ShowContactService(contactId, companyId);

  if (contact.isGroup) {
    throw new AppError("ERR_WALLET_GROUP_CONTACT", 400);
  }

  if (walletUserId) {
    const owner = await User.findByPk(walletUserId, {
      attributes: ["id", "companyId"]
    });
    if (!owner || owner.companyId !== companyId) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }
  }

  await contact.update({ walletUserId: walletUserId || null });

  return ShowContactService(contact.id, companyId);
};

export default SetContactWalletService;
