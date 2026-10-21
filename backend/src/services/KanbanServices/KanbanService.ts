import { Op, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import User from "../../models/User";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { websocketUpdateTicket } from "../TicketServices/UpdateTicketService";
import { laneOf, OPEN_LANE, planKanbanMove } from "../../helpers/KanbanRules";

// Zap Komunick: Kanban board by tags (docs/PRD.md, RF-004)

// keeps the board responsive in companies with many open tickets
const BOARD_LIMIT = 500;

export interface KanbanLane {
  tag: { id: number; name: string; color: string } | null;
  tickets: Ticket[];
}

const loadUser = async (userId: number | string): Promise<User> => {
  const user = await User.findByPk(userId, {
    include: [{ model: Queue, as: "queues", attributes: ["id"] }]
  });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }
  return user;
};

const listKanbanTags = (companyId: number) =>
  Tag.findAll({
    where: { companyId, kanban: 1 },
    attributes: ["id", "name", "color"],
    order: [["name", "ASC"]]
  });

export const ListKanbanService = async (
  userId: number | string
): Promise<{ lanes: KanbanLane[]; truncated: boolean }> => {
  const user = await loadUser(userId);
  const { companyId } = user;

  const where: WhereOptions<Ticket> = {
    companyId,
    status: { [Op.or]: ["open", "pending"] }
  };

  // same visibility as the ticket list: attendants see their own tickets and
  // the pending ones of their queues
  if (user.profile !== "admin") {
    Object.assign(where, {
      [Op.and]: [{ [Op.or]: [{ userId: user.id }, { status: "pending" }] }],
      queueId: { [Op.in]: user.queues.map(queue => queue.id) }
    });
  }

  const [tags, tickets] = await Promise.all([
    listKanbanTags(companyId),
    Ticket.findAll({
      where,
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "profilePicUrl"]
        },
        { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
        { model: User, as: "user", attributes: ["id", "name"] },
        { model: Tag, as: "tags", attributes: ["id", "name", "color"] }
      ],
      order: [["updatedAt", "DESC"]],
      limit: BOARD_LIMIT + 1
    })
  ]);

  const truncated = tickets.length > BOARD_LIMIT;
  const boardTickets = truncated ? tickets.slice(0, BOARD_LIMIT) : tickets;

  const order = tags.map(tag => tag.id);
  const lanes = new Map<number, KanbanLane>([
    [OPEN_LANE, { tag: null, tickets: [] }]
  ]);
  tags.forEach(tag => {
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
  userId
}: {
  ticketId: number;
  tagId: number;
  userId: number | string;
}): Promise<Ticket> => {
  const user = await loadUser(userId);
  const ticket = await ShowTicketService(ticketId, user.companyId);

  if (
    user.profile !== "admin" &&
    ticket.status !== "pending" &&
    ticket.userId !== user.id
  ) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  const kanbanTags = await listKanbanTags(user.companyId);

  let plan;
  try {
    plan = planKanbanMove(
      (ticket.tags || []).map(tag => tag.id),
      kanbanTags.map(tag => tag.id),
      tagId
    );
  } catch {
    throw new AppError("ERR_KANBAN_TAG_NOT_FOUND", 404);
  }

  if (plan.remove.length) {
    await TicketTag.destroy({
      where: { ticketId: ticket.id, tagId: { [Op.in]: plan.remove } }
    });
  }

  if (plan.add) {
    await TicketTag.create({ ticketId: ticket.id, tagId: plan.add });
  }

  await ticket.reload();
  websocketUpdateTicket(ticket);

  return ticket;
};
