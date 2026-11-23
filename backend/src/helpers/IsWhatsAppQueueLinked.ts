import { Transaction } from "sequelize";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";

const IsWhatsAppQueueLinked = async (
  companyId: number,
  whatsappId: number | null,
  queueId: number,
  transaction?: Transaction
): Promise<boolean> => {
  if (!whatsappId) return false;

  const whatsapp = await Whatsapp.findOne({
    transaction,
    attributes: ["id"],
    where: { id: whatsappId, companyId, channel: "whatsapp" },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: [],
        through: { attributes: [] },
        required: true,
        where: { id: queueId, companyId }
      }
    ]
  });

  return Boolean(whatsapp);
};

export default IsWhatsAppQueueLinked;
