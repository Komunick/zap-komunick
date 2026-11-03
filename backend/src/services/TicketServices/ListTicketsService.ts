import {
  Op,
  fn,
  where,
  col,
  Filterable,
  Includeable,
  WhereOptions
} from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import { intersection } from "lodash";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Whatsapp from "../../models/Whatsapp";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import ContactTag from "../../models/ContactTag";
import {
  buildTicketFilterWhere,
  TicketFilters
} from "../../helpers/TicketFilters";
import { loadTicketViewer } from "./AuthorizeTicketContextService";

interface Request {
  isSearch?: boolean;
  searchParam?: string;
  nextUpdatedAt?: string;
  status?: string;
  groups?: string;
  date?: string;
  updatedAt?: string;
  minUpdatedAt?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  notClosed?: boolean;
  all?: boolean;
  queueIds: number[];
  contactId?: number;
  tags: number[];
  users: number[];
  companyId: number;
  filters?: TicketFilters;
}

interface Response {
  tickets: Ticket[];
  count: number | null;
}

const ListTicketsService = async ({
  isSearch = false,
  searchParam = "",
  nextUpdatedAt,
  queueIds,
  contactId,
  tags,
  users,
  status,
  groups,
  date,
  updatedAt,
  minUpdatedAt,
  showAll,
  userId,
  withUnreadMessages,
  notClosed,
  all,
  companyId,
  filters
}: Request): Promise<Response> => {
  let ticketId: number;

  if (/^\d{8}-\d+$/.test(searchParam)) {
    const parts = searchParam.split("-");
    ticketId = parseInt(parts[1], 10);
  }

  if (Number(searchParam)) {
    ticketId = Number(searchParam);
  }

  if (ticketId) {
    searchParam = "";
  }

  if (
    (searchParam.trim().startsWith('"') && searchParam.trim().endsWith('"')) ||
    (searchParam.trim().startsWith("'") && searchParam.trim().endsWith("'"))
  ) {
    searchParam = searchParam.trim().slice(1, -1);
  }

  const groupsTab =
    !isSearch &&
    (await GetCompanySetting(companyId, "groupsTab", "disabled")) === "enabled";

  const user = await ShowUserService(userId);
  const viewer = await loadTicketViewer({ userId, companyId });

  const andedOrs: WhereOptions<Ticket>[] = [
    {
      [Op.or]: [{ userId }, { status: "pending" }]
    }
  ];

  let whereCondition: Filterable["where"] = {
    [Op.and]: andedOrs,
    queueId: {
      [Op.or]: user.profile === "admin" ? [queueIds, null] : [queueIds]
    }
  };

  if (groupsTab) {
    whereCondition.isGroup = groups === "true";
  }
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      where: { companyId },
      required: true,
      include: [
        { model: Tag, as: "tags", where: { companyId }, required: false },
        "extraInfo"
      ],
      attributes: ["id", "name", "number", "email", "profilePicUrl", "presence"]
    },
    {
      model: Queue,
      as: "queue",
      where: { companyId },
      required: false,
      attributes: ["id", "name", "color"]
    },
    {
      model: User,
      as: "user",
      where: { companyId },
      required: false,
      attributes: ["id", "name"]
    },
    {
      model: Tag,
      as: "tags",
      where: { companyId },
      required: false,
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      where: { companyId },
      required: false,
      attributes: ["id", "name"]
    }
  ];

  if (showAll === "true" && user.profile === "admin") {
    andedOrs.length = 0;
    whereCondition = {
      [Op.and]: andedOrs,
      queueId: { [Op.or]: [queueIds, null] }
    };
    if (groupsTab) {
      whereCondition.isGroup = groups === "true";
    }
  }

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          companyId,
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    andedOrs.push({
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    });
  }

  if (date) {
    whereCondition = {
      [Op.and]: andedOrs,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (updatedAt) {
    whereCondition = {
      [Op.and]: andedOrs,
      updatedAt: {
        [Op.between]: [
          +startOfDay(parseISO(updatedAt)),
          +endOfDay(parseISO(updatedAt))
        ]
      }
    };
  }

  if (withUnreadMessages === "true") {
    whereCondition = {
      ...whereCondition,
      unreadMessages: { [Op.gt]: 0 }
    };
  }

  // Zap Komunick: the panel's tags add to the tags of the search (RF-012)
  if (filters?.tagIds?.length) {
    tags = Array.from(new Set([...(tags || []), ...filters.tagIds]));
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const ticketsTagFilter: number[][] = [];
    const contactsTagFilter: number[][] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const tag of tags) {
      const ticketTags = await TicketTag.findAll({
        where: { tagId: tag }
      });
      if (ticketTags) {
        ticketsTagFilter.push(ticketTags.map(t => t.ticketId));
      }

      const contactTags = await ContactTag.findAll({
        where: { tagId: tag }
      });

      if (contactTags) {
        contactsTagFilter.push(contactTags.map(c => c.contactId));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsTagFilter);
    const contactsIntersection: number[] = intersection(...contactsTagFilter);

    andedOrs.push({
      [Op.or]: [
        {
          id: { [Op.in]: ticketsIntersection }
        },
        {
          contactId: { [Op.in]: contactsIntersection }
        }
      ]
    });
  }

  if (contactId) {
    whereCondition = {
      ...whereCondition,
      contactId
    };
  }

  if (ticketId) {
    whereCondition = {
      ...whereCondition,
      id: ticketId
    };
  }

  if (Array.isArray(users) && users.length > 0) {
    const ticketsUserFilter: number[][] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const u of users) {
      const ticketUsers = await Ticket.findAll({
        where: { userId: u }
      });
      if (ticketUsers) {
        ticketsUserFilter.push(ticketUsers.map(t => t.id));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsUserFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: ticketsIntersection
      }
    };
  }

  if (filters) {
    andedOrs.push(
      ...buildTicketFilterWhere(filters, {
        userId: Number(userId),
        isAdmin: user.profile === "admin",
        slaMinutes:
          Number(await GetCompanySetting(companyId, "slaMinutes", "0")) || 0
      })
    );
  }

  const limit = all ? undefined : 40;

  if (!all && nextUpdatedAt) {
    const parsedNextUpdatedAt = new Date(nextUpdatedAt);

    if (Number.isNaN(parsedNextUpdatedAt.getTime())) {
      throw new AppError("ERR_INVALID_NEXT_UPDATED_AT", 400);
    }

    andedOrs.push({
      updatedAt: { [Op.lt]: parsedNextUpdatedAt }
    });
  }

  if (minUpdatedAt) {
    const parsedMinUpdatedAt = new Date(minUpdatedAt);

    if (Number.isNaN(parsedMinUpdatedAt.getTime())) {
      throw new AppError("ERR_INVALID_MIN_UPDATED_AT", 400);
    }

    andedOrs.push({
      updatedAt: { [Op.gte]: parsedMinUpdatedAt }
    });
  }

  if (notClosed) {
    whereCondition = {
      ...whereCondition,
      status: { [Op.ne]: "closed" }
    };
  }

  whereCondition = {
    companyId,
    [Op.and]: [
      whereCondition,
      ...(viewer.isAdmin ? [] : [{ queueId: { [Op.in]: viewer.queueIds } }])
    ]
  };

  const tickets = await Ticket.findAll({
    where: whereCondition,
    include: includeCondition,
    limit,
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"]
    ],
    subQuery: false
  });

  return {
    tickets,
    count: null
  };
};

export default ListTicketsService;
