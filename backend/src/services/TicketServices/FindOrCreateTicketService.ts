import { subMinutes } from "date-fns";
import { Op } from "sequelize";
import { Mutex } from "async-mutex";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import sequelize from "../../database";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import { incrementCounter } from "../CounterServices/IncrementCounter";
import AppError from "../../errors/AppError";
import { ACTIVE_TICKET_STATUSES } from "../../helpers/TicketPauseAndClose";
import User from "../../models/User";
import {
  resolveWalletAssignment,
  WalletAssignment
} from "../../helpers/WalletRules";

const createTicketMutex = new Mutex();

// Zap Komunick: client wallet (docs/PRD.md, RF-003)
const findWalletAssignment = async (
  contact: Contact,
  whatsappId: number,
  companyId: number,
  isGroup: boolean
): Promise<WalletAssignment | null> => {
  if (isGroup || !contact?.walletUserId) {
    return null;
  }

  const enabled =
    (await GetCompanySetting(companyId, "walletAutoAssign", "disabled")) ===
    "enabled";
  if (!enabled) {
    return null;
  }

  const [owner, whatsapp] = await Promise.all([
    User.findByPk(contact.walletUserId, {
      attributes: ["id", "companyId"],
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id"],
          where: { companyId },
          required: false
        }
      ]
    }),
    Whatsapp.findOne({
      where: { id: whatsappId, companyId, channel: "whatsapp" },
      attributes: ["id"],
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id"],
          where: { companyId },
          required: false
        }
      ]
    })
  ]);

  return resolveWalletAssignment({
    enabled,
    isGroup,
    companyId,
    walletUserId: contact.walletUserId,
    ownerCompanyId: owner?.companyId ?? null,
    ownerQueueIds: (owner?.queues || []).map(queue => queue.id),
    connectionQueueIds: (whatsapp?.queues || []).map(queue => queue.id)
  });
};

type FindOrCreateTicketOptions = {
  groupContact?: Contact;
  incrementUnread?: boolean;
  doNotReopen?: boolean;
  findOnly?: boolean;
  queue?: Queue;
  inboundQueueIds?: readonly number[];
};

type TicketResult = {
  ticket: Ticket;
  justCreated: boolean;
  queueRepaired: boolean;
  startInboundQueue: boolean;
};

const repairInboundQueue = async (
  ticket: Ticket,
  inboundQueueIds: readonly number[] | undefined,
  singleQueueId: number | null
): Promise<boolean> => {
  if (
    !inboundQueueIds ||
    inboundQueueIds.includes(ticket.queueId) ||
    (!ticket.queueId && !singleQueueId)
  ) {
    return false;
  }

  const owner =
    singleQueueId && ticket.userId
      ? await User.findOne({
          where: { id: ticket.userId, companyId: ticket.companyId },
          attributes: ["id", "profile"],
          include: [
            {
              model: Queue,
              as: "queues",
              where: { id: singleQueueId, companyId: ticket.companyId },
              attributes: ["id"],
              required: false
            }
          ]
        })
      : null;
  const ownerCanServeQueue =
    owner &&
    (owner.profile === "admin" ||
      owner.queues.some(queue => queue.id === singleQueueId));

  await ticket.update({
    queueId: singleQueueId,
    chatbot: false,
    queueOptionId: null,
    ...(ownerCanServeQueue ? {} : { userId: null, status: "pending" })
  });
  return true;
};

const internalFindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  companyId: number,
  {
    groupContact,
    incrementUnread,
    doNotReopen,
    findOnly,
    queue,
    inboundQueueIds
  }: FindOrCreateTicketOptions = {}
): Promise<TicketResult> => {
  let justCreated = false;
  const singleInboundQueueId =
    inboundQueueIds?.length === 1 ? inboundQueueIds[0] : null;
  const result = await sequelize.transaction(async () => {
    // Defense in depth: a group contact must always belong to the same company
    // as the ticket being created. A cross-company group contact would leak
    // another company's contact into this company's ticket.
    if (groupContact && groupContact.companyId !== companyId) {
      throw new AppError("ERR_GROUP_CONTACT_COMPANY_MISMATCH", 400);
    }

    let ticket = await Ticket.findOne({
      where: {
        status: {
          [Op.or]: ACTIVE_TICKET_STATUSES
        },
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId
      },
      order: [["id", "DESC"]]
    });

    if (ticket && incrementUnread) {
      await ticket.increment("unreadMessages");
      ticket = await ticket.reload();
    }

    if (!ticket && groupContact) {
      ticket = await Ticket.findOne({
        where: {
          contactId: groupContact.id,
          companyId,
          whatsappId
        },
        order: [["updatedAt", "DESC"]]
      });

      if (ticket) {
        await ticket.update({
          status: "pending",
          userId: null,
          unreadMessages: incrementUnread
            ? ticket.unreadMessages + 1
            : ticket.unreadMessages,
          companyId
        });
        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });
      }
    }

    if (!doNotReopen && !ticket && !groupContact) {
      const reopenTimeout = parseInt(
        await GetCompanySetting(companyId, "autoReopenTimeout", "0"),
        10
      );
      ticket =
        reopenTimeout &&
        (await Ticket.findOne({
          where: {
            updatedAt: {
              [Op.between]: [
                +subMinutes(new Date(), reopenTimeout),
                +new Date()
              ]
            },
            contactId: contact.id,
            companyId,
            whatsappId
          },
          order: [["updatedAt", "DESC"]]
        }));

      if (ticket) {
        const wallet = await findWalletAssignment(
          contact,
          whatsappId,
          companyId,
          false
        );
        await ticket.update({
          status: "pending",
          userId: wallet?.userId ?? null,
          ...(wallet?.queueId ? { queueId: wallet.queueId } : {}),
          unreadMessages: incrementUnread
            ? ticket.unreadMessages + 1
            : ticket.unreadMessages,
          companyId
        });
        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });
      }
    }

    let queueId = queue?.id ?? singleInboundQueueId;

    if (groupContact) {
      const whatsapp = await Whatsapp.findOne({
        where: { id: whatsappId, companyId },
        include: [
          {
            model: Queue,
            as: "queues",
            where: { companyId },
            required: false
          }
        ]
      });

      if (whatsapp?.queues.length === 1) {
        queueId = whatsapp.queues[0].id;
      }
    }

    if (findOnly && !ticket) {
      return {
        ticket: null,
        justCreated: false,
        queueRepaired: false,
        startInboundQueue: false
      };
    }

    const queueRepaired = ticket
      ? await repairInboundQueue(ticket, inboundQueueIds, singleInboundQueueId)
      : false;

    if (!ticket) {
      const wallet = await findWalletAssignment(
        contact,
        whatsappId,
        companyId,
        !!groupContact
      );

      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages: incrementUnread ? 1 : 0,
        whatsappId,
        queueId: wallet?.queueId ?? queueId,
        userId: wallet?.userId ?? null,
        companyId
      });

      justCreated = true;

      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId,
        userId: ticket.userId
      });
    }

    ticket = await ShowTicketService(ticket.id, companyId);

    return {
      ticket,
      justCreated,
      queueRepaired,
      startInboundQueue:
        singleInboundQueueId !== null &&
        ticket.queueId === singleInboundQueueId &&
        (justCreated || queueRepaired) &&
        !ticket.userId
    };
  });

  if (result.justCreated) {
    incrementCounter(companyId, "ticket-create");
  }

  return result;
};

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  companyId: number,
  options: FindOrCreateTicketOptions = {}
): Promise<TicketResult> => {
  const release = await createTicketMutex.acquire();

  try {
    return await internalFindOrCreateTicketService(
      contact,
      whatsappId,
      companyId,
      options
    );
  } finally {
    release();
  }
};

export default FindOrCreateTicketService;
