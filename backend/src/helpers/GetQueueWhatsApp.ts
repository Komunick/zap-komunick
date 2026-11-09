import { col, fn } from "sequelize";
import AppError from "../errors/AppError";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";

const GetQueueWhatsApp = async (
  companyId: number,
  queueId: number,
  whatsappId?: number
): Promise<Whatsapp> => {
  const whatsapp = await Whatsapp.findOne({
    attributes: ["id", "companyId", "isDefault"],
    where: {
      companyId,
      channel: "whatsapp",
      status: "CONNECTED",
      ...(whatsappId ? { id: whatsappId } : {})
    },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: [],
        through: { attributes: [] },
        required: true,
        where: { id: queueId, companyId }
      }
    ],
    order: [
      [fn("COALESCE", col("Whatsapp.isDefault"), false), "DESC"],
      ["id", "ASC"]
    ]
  });
  if (!whatsapp) {
    throw new AppError("ERR_NO_CONNECTED_WHATSAPP_FOR_QUEUE");
  }
  return whatsapp;
};

export default GetQueueWhatsApp;
