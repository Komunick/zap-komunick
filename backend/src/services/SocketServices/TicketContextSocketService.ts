import { Server } from "socket.io";
import AuthorizeTicketContextService, {
  ContextActor,
  loadTicketViewer
} from "../TicketServices/AuthorizeTicketContextService";
import AuthorizeMessageContextService from "../MessageServices/AuthorizeMessageContextService";
import { logger } from "../../utils/logger";
import {
  MessageQuotePayload,
  sanitizeMessageQuotePayload
} from "../../helpers/MessageQuotePrivacy";

interface ContextSocket {
  data: {
    contextActor?: ContextActor;
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
    if (socket.data.ticketNotifications) {
      if (viewer.isAdmin)
        await socket.join(`company-${actor.companyId}-notification`);
      else
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
    const sockets = await io.in(rooms).fetchSockets();
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
