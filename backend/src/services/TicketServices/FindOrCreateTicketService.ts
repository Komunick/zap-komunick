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
      include: [{ model: Queue, as: "queues", attributes: ["id"] }]
    }),
    Whatsapp.findByPk(whatsappId, {
      attributes: ["id"],
      include: [{ model: Queue, as: "queues", attributes: ["id"] }]
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
    queue
  }: FindOrCreateTicketOptions = {}
): Promise<{ ticket: Ticket; justCreated: boolean }> => {
  let justCreated = false;
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

    let queueId = queue?.id || null;

    if (groupContact) {
      const whatsapp = await Whatsapp.findByPk(whatsappId, {
        include: ["queues"]
      });

      if (whatsapp?.queues.length === 1) {
        queueId = whatsapp.queues[0].id;
      }
    }

    if (findOnly && !ticket) {
      return { ticket: null, justCreated: false };
    }

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

    return { ticket, justCreated };
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
): Promise<{ ticket: Ticket; justCreated: boolean }> => {
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
