import { Op, WhereOptions } from "sequelize";
import type Ticket from "../models/Ticket";
import { ACTIVE_TICKET_STATUSES } from "./TicketPauseAndClose";

export interface KanbanActor {
  userId: number | string;
  companyId: number;
}

export interface KanbanViewer {
  userId: number;
  companyId: number;
  isAdmin: boolean;
  queueIds: number[];
}

// Zap Komunick: reads and moves use the same eligibility, including state and
// queue. Returning to the open lane must not bypass this scope.
export const kanbanTicketWhere = (
  viewer: KanbanViewer
): WhereOptions<Ticket> => ({
  companyId: viewer.companyId,
  status: { [Op.in]: [...ACTIVE_TICKET_STATUSES] },
  ...(viewer.isAdmin
    ? {}
    : {
        queueId: { [Op.in]: viewer.queueIds },
        [Op.or]: [{ userId: viewer.userId }, { status: "pending" }]
      })
});
