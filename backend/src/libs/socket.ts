/*

   DO NOT REMOVE / NÃO REMOVER

   VERSÃO EM PORTUGUÊS MAIS ABAIXO

   
   BASIC LICENSE INFORMATION:

   Author: Claudemir Todo Bom
   Email: claudemir@todobom.com
   
   Licensed under the AGPLv3 as stated on LICENSE.md file
   
   Any work that uses code from this file is obligated to 
   give access to its source code to all of its users (not only
   the system's owner running it)
   
   EXCLUSIVE LICENSE to use on closed source derived work can be
   purchased from the author and put at the root of the source
   code tree as proof-of-purchase.



   INFORMAÇÕES BÁSICAS DE LICENÇA

   Autor: Claudemir Todo Bom
   Email: claudemir@todobom.com

   Licenciado sob a licença AGPLv3 conforme arquivo LICENSE.md
    
   Qualquer sistema que inclua este código deve ter o seu código
   fonte fornecido a todos os usuários do sistema (não apenas ao
   proprietário da infraestrutura que o executa)
   
   LICENÇA EXCLUSIVA para uso em produto derivado em código fechado
   pode ser adquirida com o autor e colocada na raiz do projeto
   como prova de compra. 
   
 */

import { Server as SocketIO } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger, setSocketIo, socketSendBuffer } from "../utils/logger";
import User from "../models/User";
import Queue from "../models/Queue";
import authConfig from "../config/auth";
import { CounterManager } from "./counter";
import UserSocketSession from "../models/UserSocketSession";
import AuthorizeTicketContextService from "../services/TicketServices/AuthorizeTicketContextService";
import { refreshSocketContextRooms } from "../services/SocketServices/TicketContextSocketService";
import { DecoupledDriverServices } from "../services/DecoupledDriverServices/DecoupledDriverServices";
import { corsOrigin } from "../helpers/corsOrigin";

const decoupledDriverServices = DecoupledDriverServices.getInstance();

let io: SocketIO;

const joinTicketChannel = async (
  socket,
  ticketId: string,
  user: User,
  counters: CounterManager
) => {
  const c = counters.incrementCounter(`ticket-${ticketId}`);
  await socket.join(ticketId);
  logger.debug(`joinChatbox[${c}]: Channel: ${ticketId} by user ${user.id}`);
};

const notifyOnlineChange = (companyId: number, userId: number, online) => {
  io.to("super")
    .to(`company-${companyId}-admin`)
    .emit("userOnlineChange", { userId, online });
};

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: corsOrigin
    }
  });

  setSocketIo(io);

  if (process.env.SOCKET_ADMIN && JSON.parse(process.env.SOCKET_ADMIN)) {
    User.findByPk(1).then(adminUser => {
      instrument(io, {
        auth: {
          type: "basic",
          username: adminUser.email,
          password: adminUser.passwordHash
        },
        mode: "development"
      });
    });
  }

  UserSocketSession.update({ active: false }, { where: { active: true } }).then(
    _ => {
      logger.debug("Clossing all socket sessions");
    }
  );

  io.on("connection", async socket => {
    logger.info("Client Connected");
    const { token } = socket.handshake.query;
    let tokenData = null;
    try {
      tokenData = verify(token as string, authConfig.secret);
      logger.debug(tokenData, "io-onConnection: tokenData");
    } catch (error) {
      logger.debug(`Error decoding token: ${error?.message}`);
      socket.disconnect();
      return io;
    }
    const counters = new CounterManager();

    let user: User = null;
    const userId = tokenData.id;

    if (userId && userId !== "undefined" && userId !== "null") {
      user = await User.findByPk(userId, { include: [Queue] });
      if (user) {
        await user.save();
      } else {
        logger.info(`onConnect: User ${userId} not found`);
        socket.disconnect();
        return io;
      }
    } else {
      logger.info("onConnect: Missing userId");
      socket.disconnect();
      return io;
    }

    UserSocketSession.create({
      id: socket.id,
      userId,
      active: true
    }).then(_ => {
      logger.debug(`started session ${socket.id} for user ${userId}`);
      notifyOnlineChange(user.companyId, user.id, true);
    });

    socket.on("disconnect", async () => {
      UserSocketSession.update(
        { active: false },
        { where: { id: socket.id } }
      ).then(async () => {
        logger.debug(`finished session ${socket.id} for user ${userId}`);
        const activeSessionsCount = await UserSocketSession.count({
          where: { userId, active: true }
        });
        notifyOnlineChange(user.companyId, user.id, activeSessionsCount > 0);
      });
    });

    socket.data.contextActor = { userId: user.id, companyId: user.companyId };
    socket.data.ticketStatuses = [];
    socket.data.ticketNotifications = false;
    socket.join(`company-${user.companyId}-mainchannel`);
    socket.join(`user-${user.id}`);

    if (user.super) {
      socket.join("super");
    }

    if (user.profile === "admin") {
      socket.join(`company-${user.companyId}-admin`);
    }

    const canAccessBackendlog = user.super || tokenData?.impersonated === true;

    socket.on("joinBackendlog", () => {
      if (canAccessBackendlog) {
        socket.join("backendlog");
        io.to("backendlog").emit("backendlog", {
          timestamp: Date.now(),
          level: 30,
          logs: [
            { currentLevel: logger.level },
            "started transmission of backend logs"
          ]
        });
        socketSendBuffer();
      } else {
        logger.info(`User ${user.id} tried to join superlog channel.`);
      }
    });

    socket.on("leaveBackendlog", () => {
      if (canAccessBackendlog) {
        io.to("backendlog").emit("backendlog", {
          timestamp: Date.now(),
          level: 30,
          logs: ["finished transmission of backend logs"]
        });
        socket.leave("backendlog");
      } else {
        logger.info(`User ${user.id} tried to leave superlog channel.`);
      }
    });

    socket.on("setLoglevel", (level: string) => {
      if (canAccessBackendlog) {
        if (logger.level === level) return;

        logger.level = level;
        io.to("backendlog").emit("backendlog", {
          timestamp: Date.now(),
          level: 30,
          logs: [`Log level changed to ${level}`]
        });
      } else {
        logger.info(`User ${user.id} tried to set log level.`);
      }
    });

    socket.on("joinChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }
      try {
        await AuthorizeTicketContextService(ticketId, socket.data.contextActor);
        await joinTicketChannel(socket, ticketId, user, counters);
      } catch {
        await socket.leave(ticketId);
      }
    });

    socket.on("leaveChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }

      // o último que sair apaga a luz
      const c = counters.decrementCounter(`ticket-${ticketId}`);
      if (c === 0) {
        socket.leave(ticketId);
      }

      logger.debug(
        `leaveChatbox[${c}]: Channel: ${ticketId} by user ${user.id}`
      );
    });

    socket.on("joinNotification", async () => {
      const c = counters.incrementCounter("notification");
      if (c === 1) {
        socket.data.ticketNotifications = true;
        await refreshSocketContextRooms(socket);
      }
      logger.debug(`joinNotification[${c}]: User: ${user.id}`);
    });

    socket.on("leaveNotification", async () => {
      const c = counters.decrementCounter("notification");
      if (c === 0) {
        socket.data.ticketNotifications = false;
        await refreshSocketContextRooms(socket);
      }
      logger.debug(`leaveNotification[${c}]: User: ${user.id}`);
    });

    socket.on("joinTickets", async (status: string) => {
      if (!["pending", "open", "closed", "paused"].includes(status)) return;
      if (counters.incrementCounter(`status-${status}`) === 1) {
        socket.data.ticketStatuses.push(status);
        await refreshSocketContextRooms(socket);
      }
    });

    socket.on("leaveTickets", async (status: string) => {
      if (counters.decrementCounter(`status-${status}`) === 0) {
        socket.data.ticketStatuses = socket.data.ticketStatuses.filter(
          s => s !== status
        );
        await refreshSocketContextRooms(socket);
      }
    });

    socket.on("presenceUpdate", async parameters => {
      try {
        await AuthorizeTicketContextService(
          parameters?.ticketId,
          socket.data.contextActor
        );
        const df = decoupledDriverServices.getFunction("presenceUpdate");
        if (df) await df(user, parameters);
      } catch {
        /* No external side effect without context access. */
      }
    });

    socket.emit("ready");
    return io;
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};

/**
 * Closes the Socket.IO server and all its client connections. Used during
 * graceful shutdown so open WebSocket connections don't keep the HTTP server
 * from closing.
 */
export const closeIO = async (): Promise<void> => {
  if (!io) {
    return;
  }

  await new Promise<void>(resolve => {
    io.close(() => resolve());
  });
};
