import moment from "moment";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import BindDefaultWhatsapp from "../../helpers/BindDefaultWhatsapp";
import IsWhatsAppQueueLinked from "../../helpers/IsWhatsAppQueueLinked";
import { startQueue, verifyMessage } from "../WbotServices/wbotMessageListener";
import AppError from "../../errors/AppError";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import User from "../../models/User";
import formatBody from "../../helpers/Mustache";
import { logger } from "../../utils/logger";
import {
  emitTicketContext,
  invalidateTicketNotifications,
  removeTicketFromQueueLists,
  revokeTicketContextRooms
} from "../SocketServices/TicketContextSocketService";
import { incrementCounter } from "../CounterServices/IncrementCounter";
import { getJidOf } from "../WbotServices/getJidOf";
import Queue from "../../models/Queue";
import { _t } from "../TranslationServices/i18nService";
import {
  checkCloseReason,
  checkStatusTransition
} from "../../helpers/TicketPauseAndClose";
import { ActiveCloseReasonIds } from "../CloseReasonServices/CloseReasonService";
import {
  isWaitingInGeneralTriage,
  loadGeneralTriageScope,
  loadMemberGeneralTriageScope
} from "../../helpers/GeneralTriage";
import { loadTicketViewer } from "./AuthorizeTicketContextService";
import { assignGeneralTriageDestination } from "../WbotServices/GeneralTriageRouting";

export interface UpdateTicketData {
  status?: string;
  onlyIfPending?: boolean;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  justClose?: boolean;
  closeReasonId?: number | null;
  closeReasonNote?: string | null;
}

interface Request {
  ticketData: UpdateTicketData;
  ticketId: number;
  reqUserId?: number;
  companyId?: number | undefined;
  dontRunChatbot?: boolean;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const canNotifyOnQueue = (ticket: Ticket) =>
  ticket.channel !== "whatsapp" ||
  !ticket.queueId ||
  IsWhatsAppQueueLinked(ticket.companyId, ticket.whatsappId, ticket.queueId);

const sendFormattedMessage = async (
  message: string,
  ticket: Ticket,
  user?: User
) => {
  const messageText = formatBody(message, ticket, user);

  const wbot = await GetTicketWbot(ticket);
  const queueChangedMessage = await wbot.sendMessage(getJidOf(ticket), {
    text: messageText
  });
  await verifyMessage(queueChangedMessage, ticket, ticket.contact);
};

// Zap Komunick (RF-033): an attendant of the general queue takes (or closes) a
// ticket that is still waiting for the customer to pick a sector. The ticket
// goes to the general queue first, exactly as it would at the end of the wait
// (same bookkeeping of messages and of the waiting time), and is then accepted
// or closed like any other ticket of that queue, so it never ends up without a
// sector in the hands of someone who cannot see tickets without a sector.
// Administrators keep acting as before.
const takeIntoGeneralQueue = async (
  ticket: Ticket,
  userId: number | string
): Promise<boolean> => {
  try {
    const viewer = await loadTicketViewer({
      userId,
      companyId: ticket.companyId
    });
    if (viewer.isAdmin) return false;
    const scope = await loadMemberGeneralTriageScope(
      ticket.companyId,
      viewer.queueIds
    );
    if (!scope || !isWaitingInGeneralTriage(ticket, scope)) return false;
    const routed = await assignGeneralTriageDestination(ticket, {
      id: scope.queueId,
      chatbot: false,
      isGeneral: true
    });
    return !!routed;
  } catch {
    return false;
  }
};

export async function websocketUpdateTicket(
  ticket: Ticket,
  moreChannels?: string[]
): Promise<void> {
  const io = getIO();
  await revokeTicketContextRooms(io, ticket.id);
  await emitTicketContext(
    io,
    ticket.id,
    `company-${ticket.companyId}-ticket`,
    {
      action: "update",
      ticket
    },
    [
      ticket.id.toString(),
      `user-${ticket.userId}`,
      `queue-${ticket.queueId}-notification`,
      `queue-${ticket.queueId}-${ticket.status}`,
      `company-${ticket.companyId}-notification`,
      `company-${ticket.companyId}-${ticket.status}`,
      ...(moreChannels || [])
    ]
  );
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  reqUserId,
  companyId,
  dontRunChatbot
}: Request): Promise<Response> => {
  try {
    if (!companyId && !reqUserId) {
      throw new Error("Need reqUserId or companyId");
    }

    const user = reqUserId ? await User.findByPk(reqUserId) : null;

    if (reqUserId) {
      if (!user) {
        throw new AppError("User not found", 404);
      }
      companyId = user.companyId;
    }
    const { justClose } = ticketData;
    let { status } = ticketData;
    let { queueId, userId } = ticketData;
    const fromChatbot = ticketData.chatbot || false;
    let chatbot: boolean | null = fromChatbot;
    let queueOptionId: number | null = ticketData.queueOptionId || null;

    if (ticketId < 1 && status === "open") {
      throw new AppError("ERR_BAD_REQUEST", 400);
    }

    if (
      status === "closed" &&
      justClose &&
      user &&
      user.profile !== "admin" &&
      (await GetCompanySetting(companyId, "allowSilentlyClose", "enabled")) !==
        "enabled"
    ) {
      throw new AppError("ERR_FORBIDDEN", 403);
    }

    const io = getIO();

    const userRatingSetting = await GetCompanySetting(
      companyId,
      "userRating",
      "disabled"
    );

    const ticket = await ShowTicketService(ticketId, companyId);
    if (ticketData.onlyIfPending === true && ticket.status !== "pending") {
      throw new AppError("ERR_TICKET_NOT_PENDING", 409);
    }
    const isGroup = ticket.contact?.isGroup || ticket.isGroup;

    // Zap Komunick (RF-033): see takeIntoGeneralQueue. An accept is decided by
    // who the ticket goes to; a close, by who is closing.
    const requesterIsAttendant = !!user && user.profile !== "admin";
    const acceptsPending = ticket.status === "pending" && status === "open";
    const taker =
      acceptsPending && userId
        ? userId
        : ticket.status === "pending" &&
            status === "closed" &&
            requesterIsAttendant
          ? user.id
          : null;
    if (
      taker &&
      !ticket.queueId &&
      ticket.generalTriageStartedAt &&
      (await takeIntoGeneralQueue(ticket, taker))
    ) {
      await ticket.reload();
    }
    // The customer may pick a sector between the access check of the request
    // and this point: the ticket read here is the one that counts. An
    // attendant never ends up with a ticket of a sector they are not in (they
    // would lose it at once, and so would the sector, which only sees its
    // pending tickets).
    if (
      requesterIsAttendant &&
      acceptsPending &&
      queueId === undefined &&
      ticket.queueId != null
    ) {
      const requester = await loadTicketViewer({
        userId: user.id,
        companyId: ticket.companyId
      });
      if (!requester.queueIds.includes(ticket.queueId)) {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
    }
    // A ticket that stops waiting for a sector leaves the lists of the general
    // queue (see after the update below).
    const waitScope =
      !ticket.queueId && ticket.generalTriageStartedAt
        ? await loadGeneralTriageScope(ticket.companyId)
        : null;
    const wasWaitingForSector = isWaitingInGeneralTriage(ticket, waitScope);

    if (queueId && Number(queueId) !== ticket.queueId) {
      const newQueue = await Queue.findByPk(queueId);
      if (!newQueue) {
        throw new AppError("Queue not found", 404);
      }
      if (newQueue.companyId !== ticket.companyId) {
        throw new AppError("Queue does not belong to the same company", 403);
      }
      if (
        ticket.channel === "whatsapp" &&
        !(await IsWhatsAppQueueLinked(
          ticket.companyId,
          ticket.whatsappId,
          newQueue.id
        ))
      ) {
        throw new AppError("ERR_QUEUE_NOT_LINKED_TO_WHATSAPP");
      }
    }

    if (userId !== undefined && userId !== null) {
      if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
      const destinationUser = await User.findOne({
        where: { id: userId, companyId: ticket.companyId },
        attributes: ["id"]
      });
      if (!destinationUser) throw new AppError("ERR_NO_PERMISSION", 403);
    }

    if (user && ticket.status !== "pending") {
      if (user.profile !== "admin" && ticket.userId !== user.id) {
        throw new AppError("ERR_FORBIDDEN", 403);
      }
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket.whatsappId
    });

    if (ticket.channel === "whatsapp" && status === "open") {
      try {
        // Zap Komunick: a ticket without connection takes the default one
        // when it is accepted or reopened (reading it no longer does, RF-029)
        await BindDefaultWhatsapp(ticket).catch(err =>
          logger.warn(
            { ticketId, message: err?.message },
            "Could not bind the default connection."
          )
        );
        await SetTicketMessagesAsRead(ticket);
      } catch (err) {
        logger.error(
          { ticketId, message: err?.message },
          "Could not set messages as read."
        );
      }
    }

    const oldStatus = ticket.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket.queueId;

    // only admin can accept pending tickets that have no queue
    if (!oldQueueId && userId && oldStatus === "pending" && status === "open") {
      const acceptUser = await User.findByPk(userId);
      if (acceptUser.profile !== "admin") {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
    }

    // only admin can reopen closed tickets
    if (
      status &&
      oldStatus === "closed" &&
      status !== "closed" &&
      user &&
      user.profile !== "admin"
    ) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    if (oldStatus === "closed") {
      await CheckContactOpenTickets(
        ticket.contactId,
        ticket.whatsappId,
        false,
        reqUserId
          ? { userId: reqUserId, companyId: ticket.companyId }
          : undefined
      );
      chatbot = null;
      queueOptionId = null;
    }

    // Zap Komunick: pause and close reason (docs/PRD.md, RF-007)
    const transitionError = checkStatusTransition(oldStatus, status);
    if (transitionError) {
      throw new AppError(transitionError, 400);
    }

    if (status === "closed" && oldStatus !== "closed") {
      const closeReasonId = Number(ticketData.closeReasonId) || null;
      const closeReasonError = checkCloseReason({
        required:
          (await GetCompanySetting(
            companyId,
            "closeReasonRequired",
            "disabled"
          )) === "enabled",
        userInitiated: !!reqUserId,
        isGroup: !!isGroup,
        closeReasonId,
        activeReasonIds: await ActiveCloseReasonIds(companyId)
      });
      if (closeReasonError) {
        throw new AppError(closeReasonError, 400);
      }
      if (closeReasonId) {
        ticketTraking.closeReasonId = closeReasonId;
      }
      if (ticketData.closeReasonNote) {
        ticketTraking.closeReasonNote = String(
          ticketData.closeReasonNote
        ).slice(0, 1000);
      }
    }

    if (status !== undefined && ["closed"].indexOf(status) > -1) {
      if (!ticketTraking.finishedAt) {
        ticketTraking.finishedAt = moment().toDate();
        ticketTraking.whatsappId = ticket.whatsappId;
        ticketTraking.userId = ticket.userId;
      }

      const canNotifyOnClose =
        ticket.whatsapp?.status === "CONNECTED" &&
        !isGroup &&
        !ticket.contact.disableBot &&
        !justClose;
      const shouldRequestRating =
        canNotifyOnClose &&
        userRatingSetting === "enabled" &&
        ticket.userId &&
        !ticketTraking.ratingAt;
      const completionText = ticket.whatsapp?.complationMessage?.trim();
      const shouldSendCompletion =
        canNotifyOnClose && ticket.channel === "whatsapp" && completionText;
      const canNotify =
        (shouldRequestRating || shouldSendCompletion) &&
        (await canNotifyOnQueue(ticket));

      if (shouldRequestRating && canNotify) {
        if (ticket.channel === "whatsapp") {
          const ratingTxt =
            ticket.whatsapp.ratingMessage?.trim() ||
            _t("Please rate our service", ticket);
          const rateInstructions = _t("Send a rating from 1 to 5", ticket);
          const rateReturn = _t("Send *`!`* to return to the service", ticket);
          const bodyRatingMessage = `${ratingTxt}\n\n*${rateInstructions}*\n\n${rateReturn}`;

          await SendWhatsAppMessage({ body: bodyRatingMessage, ticket });
        }

        ticketTraking.ratingAt = moment().toDate();
        await ticketTraking.save();

        await ticket.update({
          chatbot: null,
          queueOptionId: null,
          status: "closed",
          unansweredSince: null,
          generalTriageStartedAt: null
        });

        await ticket.reload();

        io.to(`company-${ticket.companyId}-open`)
          .to(`queue-${ticket.queueId}-open`)
          .to(ticketId.toString())
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "delete",
            ticketId: ticket.id
          });

        await revokeTicketContextRooms(io, ticket.id);
        await emitTicketContext(
          io,
          ticket.id,
          `company-${ticket.companyId}-ticket`,
          {
            action: "update",
            ticket,
            ticketId: ticket.id
          },
          [
            `company-${ticket.companyId}-closed`,
            `queue-${ticket.queueId}-closed`,
            `queue-${ticket.queueId}-notification`,
            ticket.id.toString()
          ]
        );

        return { ticket, oldStatus, oldUserId };
      }

      if (shouldSendCompletion && canNotify) {
        const body = formatBody(completionText, ticket);
        const sentMessage = await SendWhatsAppMessage({ body, ticket });
        await verifyMessage(sentMessage, ticket, ticket.contact);
      }

      const keepUserAndQueue = await GetCompanySetting(
        companyId,
        "keepUserAndQueue",
        "enabled"
      );

      if (keepUserAndQueue === "disabled") {
        queueId = null;
        userId = null;
      }
    }

    if (queueId !== undefined && queueId !== null && !ticketTraking.startedAt) {
      ticketTraking.queuedAt = moment().toDate();
    }

    // Only stamp chatbotendAt on the first chatbot→human hand-off, i.e. before
    // the ticket has ever been accepted (startedAt not yet set). Subsequent
    // transfers that go through a chatbot queue and then back should not
    // overwrite this field; they belong to serviceTime, not waitTime.
    if (ticket.chatbot && !chatbot && !ticketTraking.startedAt) {
      ticketTraking.chatbotendAt = moment().toDate();
    }

    await ticket.update({
      status,
      queueId,
      userId,
      whatsappId: ticket.whatsappId,
      chatbot,
      queueOptionId,
      ...(queueId != null ||
      userId != null ||
      (status && status !== "pending") ||
      !chatbot
        ? { generalTriageStartedAt: null }
        : {}),
      ...(status === "closed" ? { unansweredSince: null } : {})
    });
    await revokeTicketContextRooms(io, ticket.id);
    if (
      wasWaitingForSector &&
      waitScope &&
      ticket.queueId !== waitScope.queueId &&
      !isWaitingInGeneralTriage(ticket, waitScope)
    ) {
      await removeTicketFromQueueLists(io, ticket, waitScope.queueId);
    }
    if (
      ticket.status !== "pending" &&
      ticket.status !== "open" &&
      (ticket.queueId !== oldQueueId || ticket.userId !== (oldUserId ?? null))
    ) {
      await invalidateTicketNotifications(io, ticket, oldQueueId);
    }

    if (oldStatus !== status) {
      if (oldStatus === "closed" && status === "open") {
        await incrementCounter(companyId, "ticket-reopen");
      } else if (status === "open") {
        await incrementCounter(companyId, "ticket-accept");
      } else if (status === "closed") {
        await incrementCounter(companyId, "ticket-close");
      } else if (status === "pending" && oldQueueId !== queueId) {
        await incrementCounter(companyId, "ticket-transfer");
      }
    }

    await ticket.reload();

    status = ticket.status;

    if (status !== undefined && ["pending"].indexOf(status) > -1) {
      if (!ticketTraking.startedAt) {
        ticketTraking.whatsappId = ticket.whatsappId;
        ticketTraking.queuedAt = moment().toDate();
        ticketTraking.startedAt = null;
        ticketTraking.userId = null;
      }
      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-ticket`,
        {
          action: "removeFromList",
          ticketId: ticket?.id
        }
      );
    }

    if (status !== undefined && ["open"].indexOf(status) > -1) {
      if (!ticketTraking.startedAt) {
        ticketTraking.startedAt = moment().toDate();
        ticketTraking.ratingAt = null;
        ticketTraking.rated = false;
        ticketTraking.whatsappId = ticket.whatsappId;
        ticketTraking.userId = ticket.userId;
      }
      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-ticket`,
        {
          action: "removeFromList",
          ticketId: ticket?.id
        }
      );

      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-ticket`,
        {
          action: "updateUnread",
          ticketId: ticket?.id
        }
      );
    }

    ticketTraking.save();

    if (
      !dontRunChatbot &&
      !ticket.userId &&
      ticket.queueId &&
      ticket.queueId !== oldQueueId
    ) {
      const wbot = await GetTicketWbot(ticket);
      if (wbot) {
        await startQueue(wbot, ticket);
        await ticket.reload();
      }
    }

    if (
      !isGroup &&
      !ticket.chatbot &&
      !ticket.contact.disableBot &&
      !fromChatbot &&
      !dontRunChatbot
    ) {
      let accepted = false;
      if (
        ticket.userId &&
        ticket.status === "open" &&
        ticket.userId !== oldUserId
      ) {
        const acceptedMessage = await GetCompanySetting(
          companyId,
          "ticketAcceptedMessage",
          ""
        );

        if (
          acceptedMessage &&
          ticket.whatsapp?.status === "CONNECTED" &&
          (await canNotifyOnQueue(ticket))
        ) {
          const acceptUser = await User.findByPk(userId);
          await sendFormattedMessage(acceptedMessage, ticket, acceptUser);
          accepted = true;
        }
      }

      if (
        !accepted &&
        oldQueueId &&
        ticket.queueId &&
        oldQueueId !== ticket.queueId &&
        ticket.whatsapp?.status === "CONNECTED"
      ) {
        const systemTransferMessage = await GetCompanySetting(
          companyId,
          "transferMessage",
          ""
        );
        const transferMessage =
          ticket.whatsapp.transferMessage || systemTransferMessage;

        if (transferMessage && (await canNotifyOnQueue(ticket))) {
          await sendFormattedMessage(transferMessage, ticket);
        }
      }
    }

    if (justClose && status === "closed") {
      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-ticket`,
        {
          action: "removeFromList",
          ticketId: ticket?.id
        }
      );
    } else if (ticket.status === "closed" && ticket.status !== oldStatus) {
      io.to(`company-${companyId}-${oldStatus}`)
        .to(`queue-${ticket.queueId}-${oldStatus}`)
        .to(`user-${oldUserId}`)
        .emit(`company-${companyId}-ticket`, {
          action: "removeFromList",
          ticketId: ticket.id
        });
    }

    await websocketUpdateTicket(ticket, [`user-${oldUserId}`]);

    return { ticket, oldStatus, oldUserId };
  } catch (err) {
    logger.error(
      { error: err?.name, message: err?.message, stack: err?.stack },
      "UpdateTicketService"
    );
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("Error updating ticket", 500);
  }
};

export default UpdateTicketService;
