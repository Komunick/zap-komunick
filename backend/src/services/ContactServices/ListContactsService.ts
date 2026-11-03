import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import User from "../../models/User";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  walletUserId?: number;
  // Zap Komunick: contacts without an owner (RF-014)
  withoutWallet?: boolean;
  // Zap Komunick: contacts with any of these tags, on the contact or on one
  // of its tickets (RF-019)
  tagIds?: number[];
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  walletUserId,
  withoutWallet,
  tagIds
}: Request): Promise<Response> => {
  const normalizedSearchParam = searchParam.toLowerCase().trim();
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn(
            "LOWER",
            Sequelize.fn("UNACCENT", Sequelize.col("Contact.name"))
          ),
          {
            [Op.like]: Sequelize.literal(
              `'%' || UNACCENT('${normalizedSearchParam}') || '%'`
            )
          }
        )
      },
      { number: { [Op.like]: `%${normalizedSearchParam}%` } }
    ],
    companyId: {
      [Op.eq]: companyId
    },
    ...(walletUserId ? { walletUserId } : {}),
    ...(withoutWallet ? { walletUserId: null, isGroup: false } : {}),
    ...(tagIds?.length
      ? {
          id: {
            [Op.in]: Sequelize.literal(`(
              SELECT ct."contactId" FROM "ContactTags" ct
              WHERE ct."tagId" IN (${tagIds.map(Number).join(",")})
              UNION
              SELECT t."contactId" FROM "TicketTags" tt
              JOIN "Tickets" t ON t.id = tt."ticketId"
              WHERE tt."tagId" IN (${tagIds.map(Number).join(",")})
            )`)
          }
        }
      : {})
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    distinct: true,
    include: [
      "tags",
      { model: User, as: "walletUser", attributes: ["id", "name"] }
    ],
    limit,
    offset,
    order: [[Sequelize.col("Contact.name"), "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
