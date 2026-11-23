import { FindOptions } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Company from "../../models/Company";
import { sortWhatsappQueues } from "../../helpers/WhatsappQueueMenu";

type ShowWhatsAppOptions = {
  hideSession?: boolean;
  companyId?: number;
};

const ShowWhatsAppService = async (
  id: string | number,
  options: ShowWhatsAppOptions = {}
): Promise<Whatsapp> => {
  const findOptions: FindOptions = {
    include: [
      {
        model: Queue,
        as: "queues",
        ...(options.companyId === undefined
          ? {}
          : { where: { companyId: options.companyId }, required: false }),
        attributes: [
          "id",
          "name",
          "color",
          "greetingMessage",
          "outOfHoursMessage",
          "mediaPath",
          "mediaName"
        ],
        include: [
          {
            model: QueueOption,
            as: "options",
            required: false,
            where: { parentId: null }
          }
        ]
      },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name", "language"]
      }
    ],
    // Alphabetical here only breaks ties: the menu order saved for the channel
    // (WhatsappQueues.position) is applied below.
    order: [
      ["queues", "name", "ASC"],
      [Sequelize.cast(Sequelize.col("queues.options.option"), "INTEGER"), "ASC"]
    ]
  };

  if (options.hideSession) {
    findOptions.attributes = { exclude: ["session"] };
  }

  const whatsapp =
    options.companyId === undefined
      ? await Whatsapp.findByPk(id, findOptions)
      : await Whatsapp.findOne({
          ...findOptions,
          where: { id, companyId: options.companyId }
        });

  // In place, so the instance and its JSON keep the same array.
  if (whatsapp?.queues?.length > 1) {
    const ordered = sortWhatsappQueues(whatsapp.queues);
    whatsapp.queues.splice(0, whatsapp.queues.length, ...ordered);
  }

  return whatsapp;
};

export default ShowWhatsAppService;
