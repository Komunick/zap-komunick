// Zap Komunick: tells who has the open ticket that blocks a new conversation
// with the same client (docs/PRD.md, RF-026).
import { TicketViewer } from "./TicketAccessRules";

export interface OpenTicketFacts {
  id: number;
  uuid: string;
  status: string;
  userId: number | null;
  queueId: number | null;
  updatedAt: Date | string;
  user?: { id: number; name: string } | null;
  queue?: { id: number; name: string; color?: string } | null;
  whatsapp?: { id: number; name: string; status?: string } | null;
}

export interface OpenTicketConflict {
  id: number;
  uuid: string;
  status: string;
  updatedAt: string | null;
  user: { id: number; name: string } | null;
  queue: { id: number; name: string; color: string | null } | null;
  whatsapp: { id: number; name: string; connected: boolean } | null;
  /** The requester may open it (null when the requester is unknown). */
  canView: boolean | null;
  /** The requester may take it with the rules of UpdateTicketService. */
  canTake: boolean | null;
}

export interface ConflictRequester {
  userId: number;
  viewer: TicketViewer;
}

export function describeOpenTicket(
  ticket: OpenTicketFacts,
  requester?: ConflictRequester
): OpenTicketConflict {
  let canView: boolean | null = null;
  let canTake: boolean | null = null;

  if (requester) {
    const { viewer, userId } = requester;
    const ownTicket = ticket.userId === userId;
    const inQueue =
      ticket.queueId !== null && viewer.queueIds.includes(ticket.queueId);
    // same rule as ticketContextError: the owner outside the queue cannot
    // open it either
    canView = viewer.isAdmin || inQueue;

    if (ownTicket) {
      // already with the requester: nothing to take, only open it
      canTake = false;
    } else if (ticket.status === "pending") {
      // accepting a pending ticket: queue members; without queue only admins
      canTake = viewer.isAdmin || inQueue;
    } else {
      // a ticket in service with someone else: only admins take it over
      canTake = viewer.isAdmin;
    }
  }

  return {
    id: ticket.id,
    uuid: ticket.uuid,
    status: ticket.status,
    updatedAt: Number.isNaN(new Date(ticket.updatedAt).getTime())
      ? null
      : new Date(ticket.updatedAt).toISOString(),
    user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null,
    queue: ticket.queue
      ? {
          id: ticket.queue.id,
          name: ticket.queue.name,
          color: ticket.queue.color || null
        }
      : null,
    whatsapp: ticket.whatsapp
      ? {
          id: ticket.whatsapp.id,
          name: ticket.whatsapp.name,
          connected: ticket.whatsapp.status === "CONNECTED"
        }
      : null,
    canView,
    canTake
  };
}
