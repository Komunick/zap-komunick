import { Request, Response } from "express";
import { Mutex } from "async-mutex";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import AppError from "../errors/AppError";
import {
  BULK_FROM_STATUSES,
  parseBulkRequest
} from "../helpers/BulkTicketActions";
import { parseTicketFilters } from "../helpers/TicketFilters";
import { parseTransferNote } from "../helpers/TransferNote";
import CreateTransferNoteService from "../services/MessageServices/CreateTransferNoteService";
import SyncTagService from "../services/TagServices/SyncTagsService";
import Tag from "../models/Tag";
import { GetCompanySetting } from "../helpers/CheckSettings";
import { ticketTagIds } from "../helpers/TagScope";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";
import AuthorizeTicketContextService, {
  loadTicketViewer
} from "../services/TicketServices/AuthorizeTicketContextService";
import Contact from "../models/Contact";
import Queue from "../models/Queue";
import User from "../models/User";
import { emitTicketContext } from "../services/SocketServices/TicketContextSocketService";

type IndexQuery = {
  isSearch?: string;
  searchParam: string;
  pageNumber?: string;
  nextUpdatedAt?: string;
  nextTicketId?: string;
  status: string;
  groups: string;
  date: string;
  updatedAt?: string;
  minUpdatedAt?: string;
  showAll: string;
  withUnreadMessages: string;
  notClosed: string;
  all: string;
  queueIds: string;
  contactId: string;
  tags: string;
  users: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
}

const updateMutex = new Mutex();

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    nextUpdatedAt,
    status,
    groups,
    date,
    updatedAt,
    minUpdatedAt,
    isSearch,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    contactId,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    notClosed,
    all
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId } = req.user;

  // Zap Komunick: filter panel of the list (RF-012)
  const { filters, error: filterError } = parseTicketFilters(req.query);
  if (filterError) {
    throw new AppError(filterError, 400);
  }

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count } = await ListTicketsService({
    isSearch: isSearch === "true",
    searchParam,
    contactId: Number(contactId) || undefined,
    tags: tagsIds,
    users: usersIds,
    nextUpdatedAt,
    status,
    groups,
    date,
    updatedAt,
    minUpdatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    notClosed: !!notClosed,
    all: !!all,
    companyId,
    filters
  });

  return res.status(200).json({
    tickets,
    count
  });
};

export const kanban = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    companyId
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, queueId }: TicketData = req.body;
  const { companyId } = req.user;

  const viewer = await loadTicketViewer({ userId: req.user.id, companyId });
  if (
    !viewer.isAdmin &&
    (!viewer.queueIds.includes(Number(queueId)) ||
      Number(userId) !== Number(req.user.id))
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const contact = await Contact.findOne({
    where: { id: contactId, companyId },
    attributes: ["id"]
  });
  const owner = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id"]
  });
  const queue = queueId
    ? await Queue.findOne({
        where: { id: queueId, companyId },
        attributes: ["id"]
      })
    : null;
  if (!contact || !owner || (queueId && !queue)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const ticket = await CreateTicketService({
    contactId,
    userId,
    companyId,
    queueId
  });

  const io = getIO();
  await AuthorizeTicketContextService(ticket.id, {
    userId: req.user.id,
    companyId
  });
  await emitTicketContext(
    io,
    ticket.id,
    `company-${companyId}-ticket`,
    {
      action: "update",
      ticket
    },
    [
      `company-${companyId}-${ticket.status}`,
      `queue-${ticket.queueId}-${ticket.status}`
    ]
  );

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  await AuthorizeTicketContextService(ticketId, {
    userId: req.user.id,
    companyId
  });
  const contact = await ShowTicketService(ticketId, companyId);

  return res.status(200).json(contact);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;

  const ticket: Ticket = await ShowTicketUUIDService(uuid, req.user.companyId);
  await AuthorizeTicketContextService(ticket.id, {
    userId: req.user.id,
    companyId: req.user.companyId
  });

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  await AuthorizeTicketContextService(ticketId, {
    userId: req.user.id,
    companyId: req.user.companyId
  });

  // Zap Komunick: where the ticket was before, for the transfer note (RF-017)
  const before = await Ticket.findByPk(ticketId, {
    attributes: ["id", "queueId", "userId", "companyId"]
  });

  const { ticket } = await updateMutex.runExclusive(async () => {
    const result = await UpdateTicketService({
      ticketData: req.body,
      ticketId: Number.parseInt(ticketId, 10),
      reqUserId: Number(req.user.id)
    });
    return result;
  });

  const parsedNote = parseTransferNote({
    note: req.body?.transferNote,
    messageIds: req.body?.transferMessageIds
  });
  const moved =
    before &&
    (before.queueId !== ticket.queueId || before.userId !== ticket.userId);
  if (parsedNote && moved && before.companyId === req.user.companyId) {
    await CreateTransferNoteService({
      ticket,
      parsed: parsedNote,
      userId: Number(req.user.id),
      fromQueueId: before.queueId,
      fromUserId: before.userId
    });
  }

  return res.status(200).json(ticket);
};

// Zap Komunick: accept, transfer or close many tickets at once (RF-011). Each
// one goes through UpdateTicketService; a failure does not stop the others.
export const bulk = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const reqUserId = Number(req.user.id);

  const parsed = parseBulkRequest(req.body, reqUserId);
  if (parsed.error) {
    throw new AppError(parsed.error, 400);
  }

  const tickets = await Ticket.findAll({
    where: { id: parsed.ticketIds, companyId },
    attributes: ["id", "status"]
  });
  const statusById = new Map(tickets.map(t => [t.id, t.status]));
  const allowed = BULK_FROM_STATUSES[parsed.action];

  const done: number[] = [];
  const failed: { id: number; error: string }[] = [];

  // Zap Komunick: tagging adds the chosen tags to the ones already there
  // (RF-019), in the company's tag mode (on the ticket or on the contact)
  let selectedTags: Tag[] = [];
  let tagsMode = "ticket";
  if (parsed.action === "tag") {
    selectedTags = await Tag.findAll({
      where: { id: parsed.data.tagIds as number[], companyId },
      attributes: ["id", "queueIds"]
    });
    if (!selectedTags.length) {
      throw new AppError("ERR_BULK_NO_TAGS", 400);
    }
    tagsMode = await GetCompanySetting(companyId, "tagsMode", "ticket");
  }

  const applyOne = async (ticketId: number) => {
    await AuthorizeTicketContextService(ticketId, {
      userId: reqUserId,
      companyId
    });
    if (parsed.action !== "tag") {
      await updateMutex.runExclusive(() =>
        UpdateTicketService({
          ticketData: { ...parsed.data },
          ticketId,
          reqUserId
        })
      );
      return;
    }
    const current = await ShowTicketService(ticketId, companyId);
    const tagIds = ticketTagIds(
      selectedTags,
      selectedTags,
      current.queueId || null
    );
    if (!tagIds.length) {
      throw new AppError("ERR_BULK_NO_TAGS", 400);
    }
    const existing =
      tagsMode === "contact" ? current.contact?.tags || [] : current.tags || [];
    const union = Array.from(new Set([...existing.map(t => t.id), ...tagIds]));
    await SyncTagService({
      tags: union.map(id => ({ id })) as Tag[],
      ticketId,
      companyId
    });
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const ticketId of parsed.ticketIds) {
    const status = statusById.get(ticketId);
    if (!status) {
      failed.push({ id: ticketId, error: "ERR_NO_TICKET_FOUND" });
    } else if (!allowed.includes(status)) {
      failed.push({ id: ticketId, error: "ERR_BULK_WRONG_STATUS" });
    } else {
      try {
        await applyOne(ticketId);
        done.push(ticketId);
      } catch (err) {
        failed.push({ id: ticketId, error: err?.message || "ERR_UNKNOWN" });
      }
    }
  }

  return res.status(200).json({ done, failed });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  await AuthorizeTicketContextService(ticketId, {
    userId: req.user.id,
    companyId
  });

  const ticket = await DeleteTicketService(ticketId);

  const io = getIO();
  io.to(ticketId)
    .to(`company-${companyId}-${ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-notification`)
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};
