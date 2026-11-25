import { Server } from "socket.io";
import AuthorizeTicketContextService, {
  ContextActor,
  loadTicketViewer
} from "../TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../MessageServices/AuthorizeMessageContextService";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import {
  GeneralTriageTicket,
  isWaitingInGeneralTriage,
  loadGeneralTriageScope
} from "../../helpers/GeneralTriage";
import {
  MessageQuotePayload,
  sanitizeMessageQuotePayload
} from "../../helpers/MessageQuotePrivacy";

interface ContextSocket {
  data: {
    contextActor?: ContextActor;
    ticketListUpdates?: boolean;
    ticketNotifications?: boolean;
    ticketStatuses?: string[];
  };
  rooms: Set<string>;
  join(room: string): unknown;
  leave(room: string): unknown;
  emit(event: string, payload: unknown): unknown;
}

const isContextRoom = (room: string) =>
  /^queue-\d+-(notification|pending|open|closed|paused)$/.test(room) ||
  /^company-\d+-(admin|notification|pending|open|closed|paused)$/.test(room);

export async function refreshSocketContextRooms(
  socket: ContextSocket
): Promise<void> {
  await Promise.all(
    [...socket.rooms].filter(isContextRoom).map(room => socket.leave(room))
  );
  const actor = socket.data.contextActor;
  if (!actor) return;
  try {
    const viewer = await loadTicketViewer(actor);
    if (viewer.isAdmin) await socket.join(`company-${actor.companyId}-admin`);
    if (viewer.isAdmin && socket.data.ticketListUpdates) {
      await socket.join(`company-${actor.companyId}-notification`);
    }
    if (
      socket.data.ticketNotifications ||
      (!viewer.isAdmin && socket.data.ticketListUpdates)
    ) {
      await Promise.all(
        viewer.queueIds.map(id => socket.join(`queue-${id}-notification`))
      );
    }
    await Promise.all(
      (socket.data.ticketStatuses || []).map(async status => {
        if (viewer.isAdmin)
          await socket.join(`company-${actor.companyId}-${status}`);
        else if (status === "pending") {
          await Promise.all(
            viewer.queueIds.map(id => socket.join(`queue-${id}-pending`))
          );
        }
      })
    );
  } catch {
    // A removed user or a failed lookup cannot retain contextual subscriptions.
  }
}

async function canReceive(
  socket: ContextSocket,
  ticketId: string | number
): Promise<boolean> {
  try {
    if (!socket.data.contextActor) {
      await socket.leave(String(ticketId));
      return false;
    }
    await AuthorizeTicketContextService(ticketId, socket.data.contextActor);
    return true;
  } catch {
    await socket.leave(String(ticketId));
    return false;
  }
}

export async function revokeTicketContextRooms(
  io: Server,
  ticketId: string | number
): Promise<void> {
  const sockets = await io.in(String(ticketId)).fetchSockets();
  await Promise.all(sockets.map(socket => canReceive(socket, ticketId)));
}

// Recipients in the old sector may still have a cached notification after
// transfer. Invalidate it without delivering the now inaccessible ticket.
export async function invalidateTicketNotifications(
  io: Server,
  ticket: { id: number; companyId: number },
  previousQueueId: number | null | undefined
): Promise<void> {
  if (previousQueueId == null) return;
  try {
    const sockets = await io
      .in(`queue-${previousQueueId}-notification`)
      .fetchSockets();
    sockets.forEach(socket => {
      if (socket.data.contextActor?.companyId === ticket.companyId) {
        socket.emit(`company-${ticket.companyId}-ticket`, {
          action: "removeFromList",
          ticketId: ticket.id
        });
      }
    });
  } catch {
    logger.warn("Could not invalidate transferred ticket notifications");
  }
}

// Zap Komunick (RF-033): the people of a queue stop seeing a ticket that left
// it by a way that does not reach them (a ticket that was waiting for a sector
// and went to another one, or was taken by an administrator). The row is taken
// out of their lists; whoever may still see it gets it back with the update
// that follows.
export async function removeTicketFromQueueLists(
  io: Server,
  ticket: { id: number; companyId: number },
  queueId: number | null | undefined
): Promise<void> {
  if (queueId == null) return;
  try {
    const sockets = await io
      .in([`queue-${queueId}-notification`, `queue-${queueId}-pending`])
      .fetchSockets();
    sockets.forEach(socket => {
      if (socket.data.contextActor?.companyId === ticket.companyId) {
        socket.emit(`company-${ticket.companyId}-ticket`, {
          action: "removeFromList",
          ticketId: ticket.id
        });
      }
    });
  } catch {
    logger.warn("Could not take a ticket out of the lists of its old queue");
  }
}

// A ticket that was waiting for a sector and is gone (deleted) leaves the lists
// of the general queue. `ticket` is the ticket as it was. Never throws.
export async function removeWaitingTicketFromGeneralLists(
  io: Server,
  ticket: GeneralTriageTicket & { id: number; companyId: number }
): Promise<void> {
  if (ticket.queueId != null || !ticket.generalTriageStartedAt) return;
  try {
    const scope = await loadGeneralTriageScope(ticket.companyId);
    if (scope && isWaitingInGeneralTriage(ticket, scope)) {
      await removeTicketFromQueueLists(io, ticket, scope.queueId);
    }
  } catch {
    logger.warn("Could not take a deleted ticket out of the general lists");
  }
}

const NO_QUEUE_ROOM = /^queue-null-/;

// Zap Komunick (RF-033): the events of a ticket without a queue are addressed
// to rooms nobody is in ("queue-null-..."). While the ticket waits for the
// customer to pick a sector, the rooms of the general queue are added, so its
// attendants get the conversation live. Each recipient is still authorized
// one by one below. Only tickets without a queue cost the extra lookup.
export async function withGeneralTriageRooms(
  ticketId: string | number,
  rooms: string[]
): Promise<string[]> {
  const noQueue = rooms.filter(room => NO_QUEUE_ROOM.test(room));
  if (!noQueue.length) return rooms;
  try {
    const ticket = await Ticket.findOne({
      where: { id: ticketId },
      attributes: [
        "id",
        "companyId",
        "status",
        "channel",
        "isGroup",
        "queueId",
        "userId",
        "whatsappId",
        "generalTriageStartedAt"
      ]
    });
    if (!ticket || !ticket.generalTriageStartedAt) return rooms;
    const scope = await loadGeneralTriageScope(ticket.companyId);
    if (!scope || !isWaitingInGeneralTriage(ticket, scope)) return rooms;
    return [
      ...rooms,
      ...noQueue.map(room =>
        room.replace(NO_QUEUE_ROOM, `queue-${scope.queueId}-`)
      )
    ];
  } catch {
    return rooms;
  }
}

export async function refreshUserContextSockets(
  io: Server,
  userId: string | number
): Promise<void> {
  const sockets = await io.in(`user-${userId}`).fetchSockets();
  await Promise.all(
    sockets.map(async socket => {
      await refreshSocketContextRooms(socket);
      await Promise.all(
        [...socket.rooms]
          .filter(room => /^\d+$/.test(room))
          .map(room => canReceive(socket, room))
      );
    })
  );
}

interface MessageReference extends MessageQuotePayload {
  id: string;
  ticketId?: number;
}

interface EventMessage extends MessageQuotePayload {
  companyId?: number;
  ticketId?: number;
  quotedMsg?: MessageReference | null;
  replies?: MessageReference[];
  toJSON?: () => EventMessage;
}

interface EventPayload {
  message?: EventMessage;
  [key: string]: unknown;
}

async function visiblePayload(
  payload: EventPayload,
  actor: ContextActor,
  ticketId: string | number
): Promise<EventPayload> {
  if (!payload.message) return payload;
  const message = payload.message.toJSON
    ? payload.message.toJSON()
    : { ...payload.message };
  const canReadReference = async (reference: MessageReference) => {
    const sourceId = reference.ticketId;
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) return false;
    try {
      await AuthorizeMessageContextService(
        reference.id,
        actor,
        ticketId,
        sourceId
      );
      return true;
    } catch {
      return false;
    }
  };
  if (message.quotedMsg && !(await canReadReference(message.quotedMsg))) {
    message.quotedMsg = null;
  }
  if (message.replies) {
    const allowed = await Promise.all(
      message.replies.map(async reply =>
        (await canReadReference(reply)) ? reply : null
      )
    );
    message.replies = allowed.filter(reply => reply !== null);
  }
  return { ...payload, message: sanitizeMessageQuotePayload(message) };
}

// Zap Komunick: keep the existing candidate rooms, but authorize actual current
// recipients. A cached subscription or the assigned-user room grants no access.
export async function emitTicketContext(
  io: Server,
  ticketId: string | number,
  event: string,
  payload: EventPayload,
  rooms: string[]
): Promise<void> {
  try {
    const sockets = await io
      .in(await withGeneralTriageRooms(ticketId, rooms))
      .fetchSockets();
    await Promise.all(
      sockets.map(async socket => {
        if (!(await canReceive(socket, ticketId))) return;
        const actor = socket.data.contextActor as ContextActor;
        if (
          payload.message?.companyId !== undefined &&
          payload.message.companyId !== actor.companyId
        )
          return;
        if (
          payload.message?.ticketId !== undefined &&
          payload.message.ticketId !== Number(ticketId)
        )
          return;
        socket.emit(event, await visiblePayload(payload, actor, ticketId));
      })
    );
  } catch {
    logger.warn("Context event withheld because authorization was unavailable");
  }
}
