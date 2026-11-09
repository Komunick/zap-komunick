import { FindOptions } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Company from "../../models/Company";

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
    order: [
      ["queues", "name", "ASC"],
      [Sequelize.cast(Sequelize.col("queues.options.option"), "INTEGER"), "ASC"]
    ]
  };

  if (options.hideSession) {
    findOptions.attributes = { exclude: ["session"] };
  }

  if (options.companyId !== undefined) {
    return Whatsapp.findOne({
      ...findOptions,
      where: { id, companyId: options.companyId }
    });
  }

  return Whatsapp.findByPk(id, findOptions);
};

export default ShowWhatsAppService;
