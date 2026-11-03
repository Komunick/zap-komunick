import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import User from "../../models/User";
import UserQueue from "../../models/UserQueue";
import sequelize from "../../database";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { websocketUpdateTicket } from "../TicketServices/UpdateTicketService";
import { laneOf, OPEN_LANE, planKanbanMove } from "../../helpers/KanbanRules";
import {
  KanbanActor,
  KanbanViewer,
  kanbanTicketWhere
} from "../../helpers/KanbanVisibility";
import { isTagVisible } from "../../helpers/TagScope";

// Zap Komunick: Kanban board by tags (docs/PRD.md, RF-004)

// keeps the board responsive in companies with many open tickets
const BOARD_LIMIT = 500;

export interface KanbanLane {
  tag: { id: number; name: string; color: string } | null;
  tickets: Ticket[];
}

const loadViewer = async (
  { userId, companyId }: KanbanActor,
  transaction?: Transaction
): Promise<KanbanViewer> => {
  const user = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id", "companyId", "profile"],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });
  if (!user || user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const viewer: KanbanViewer = {
    userId: user.id,
    companyId,
    isAdmin: user.profile === "admin",
    queueIds: []
  };
  if (viewer.isAdmin) return viewer;

  const candidates = await UserQueue.findAll({
    where: { userId: user.id },
    attributes: ["queueId"],
    transaction
  });
  const ids = [...new Set(candidates.map(membership => membership.queueId))];
  if (!ids.length) return viewer;

  // Lock parent queues before memberships, matching queue deletion's FK order.
  // Re-read memberships after those locks so a removed association cannot grant
  // a move. Foreign legacy queue associations never authorize this company.
  const queues = await Queue.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["id"],
    order: [["id", "ASC"]],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });
  const memberships = await UserQueue.findAll({
    where: {
      userId: user.id,
      queueId: { [Op.in]: queues.map(queue => queue.id) }
    },
    attributes: ["queueId"],
    order: [["queueId", "ASC"]],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });
  viewer.queueIds = memberships.map(membership => membership.queueId);
  return viewer;
};

const listKanbanTags = (companyId: number, transaction?: Transaction) =>
  Tag.findAll({
    where: { companyId, kanban: 1 },
    attributes: ["id", "name", "color", "queueIds"],
    order: [[transaction ? "id" : "name", "ASC"]],
    ...(transaction ? { transaction, lock: transaction.LOCK.SHARE } : {})
  });

export const ListKanbanService = async (
  actor: KanbanActor
): Promise<{ lanes: KanbanLane[]; truncated: boolean }> => {
  const viewer = await loadViewer(actor);
  const { companyId } = viewer;

  const [tags, tickets] = await Promise.all([
    listKanbanTags(companyId),
    Ticket.findAll({
      where: kanbanTicketWhere(viewer),
      include: [
        {
          model: Contact,
          as: "contact",
          where: { companyId },
          required: true,
          attributes: ["id", "name", "number", "profilePicUrl"]
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
        }
      ],
      order: [["updatedAt", "DESC"]],
      limit: BOARD_LIMIT + 1
    })
  ]);

  const truncated = tickets.length > BOARD_LIMIT;
  const boardTickets = truncated ? tickets.slice(0, BOARD_LIMIT) : tickets;

  const visibleTags = tags.filter(tag => isTagVisible(tag, viewer));
  const order = visibleTags.map(tag => tag.id);
  const lanes = new Map<number, KanbanLane>([
    [OPEN_LANE, { tag: null, tickets: [] }]
  ]);
  visibleTags.forEach(tag => {
    lanes.set(tag.id, {
      tag: { id: tag.id, name: tag.name, color: tag.color },
      tickets: []
    });
  });

  boardTickets.forEach(ticket => {
    const lane = laneOf(
      (ticket.tags || []).map(tag => tag.id),
      order
    );
    lanes.get(lane).tickets.push(ticket);
  });

  return { lanes: [...lanes.values()], truncated };
};

export const MoveKanbanTicketService = async ({
  ticketId,
  tagId,
  userId,
  companyId
}: {
  ticketId: number;
  tagId: number;
  userId: number | string;
  companyId: number;
}): Promise<Ticket> => {
  const ticket = await sequelize.transaction(async transaction => {
    const viewer = await loadViewer({ userId, companyId }, transaction);
    // No eager joins on a locking query: PostgreSQL cannot FOR UPDATE the
    // nullable side of those joins. Hydration happens only after eligibility.
    const target = await Ticket.findOne({
      where: { ...kanbanTicketWhere(viewer), id: ticketId },
      attributes: ["id", "queueId", "contactId"],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!target) throw new AppError("ERR_NO_TICKET_FOUND", 404);
    // Match the list's required same-company contact without locking this
    // parent after Ticket (contact deletion takes the opposite FK order).
    const contact = target.contactId
      ? await Contact.findOne({
          where: { id: target.contactId, companyId },
          attributes: ["id"],
          transaction
        })
      : null;
    if (!contact) throw new AppError("ERR_NO_TICKET_FOUND", 404);

    const kanbanTags = await listKanbanTags(companyId, transaction);
    if (tagId !== OPEN_LANE) {
      const destination = kanbanTags.find(tag => tag.id === tagId);
      if (
        !destination ||
        !isTagVisible(destination, {
          ...viewer,
          ticketQueueId: target.queueId ?? null
        })
      ) {
        throw new AppError("ERR_KANBAN_TAG_NOT_FOUND", 404);
      }
    }
    const currentTags = await TicketTag.findAll({
      where: { ticketId: target.id },
      attributes: ["tagId"],
      order: [["tagId", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    let plan;
    try {
      plan = planKanbanMove(
        currentTags.map(tag => tag.tagId),
        kanbanTags.map(tag => tag.id),
        tagId
      );
    } catch {
      throw new AppError("ERR_KANBAN_TAG_NOT_FOUND", 404);
    }

    if (plan.remove.length) {
      await TicketTag.destroy({
        where: { ticketId: target.id, tagId: { [Op.in]: plan.remove } },
        transaction
      });
    }
    if (plan.add) {
      await TicketTag.create(
        { ticketId: target.id, tagId: plan.add },
        { transaction }
      );
    }
    return ShowTicketService(target.id, companyId, transaction);
  });

  await websocketUpdateTicket(ticket);
  return ticket;
};
