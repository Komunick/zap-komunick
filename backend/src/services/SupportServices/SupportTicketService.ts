import { Op, Transaction, WhereOptions, col, literal } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import SupportMessage, { SupportAttachment } from "../../models/SupportMessage";
import SupportTicket from "../../models/SupportTicket";
import User from "../../models/User";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { supportFilePath } from "../../config/supportUpload";
import {
  SUPPORT_ACTIONS,
  SUPPORT_BODY_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_LOCATION_MAX,
  SUPPORT_MESSAGES_PER_HOUR,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKETS_PER_HOUR,
  SUPPORT_TITLE_MAX,
  SupportStatus,
  isSupportFinished,
  supportActionResult,
  supportOption,
  supportStatusAfterMessage,
  supportText
} from "../../helpers/SupportRules";
import {
  SupportViewer,
  actsAsSupport,
  canViewSupportTicket,
  isSupportRequester,
  supportMessageView,
  supportTicketView
} from "../../helpers/SupportView";

// Zap Komunick: support tickets with a live conversation (docs/PRD.md,
// RF-030), modelled on the Brazil TMS ticket desk.
const HOUR = 60 * 60 * 1000;
const LIST_LIMIT = 200;

const notFound = () => new AppError("ERR_SUPPORT_TICKET_NOT_FOUND", 404);

// The screens fetch again when told something changed, so the event carries
// no ticket data and each side only ever receives what its own request allows.
const emitSupportTicket = (
  ticket: Pick<SupportTicket, "id" | "userId">,
  action: string
): void => {
  try {
    let target = getIO().to("super");
    if (ticket.userId) target = target.to(`user-${ticket.userId}`);
    target.emit("supportTicket", { action, ticketId: ticket.id });
  } catch (error) {
    logger.warn(
      { ticketId: ticket.id, message: error?.message },
      "Support ticket event not sent"
    );
  }
};

const actorName = async (viewer: SupportViewer): Promise<string> => {
  const user = await User.findOne({
    where: { id: viewer.userId, companyId: viewer.companyId },
    attributes: ["id", "name"]
  });
  if (!user) throw new AppError("ERR_NO_PERMISSION", 403);
  return user.name;
};

const findVisible = async (
  ticketId: number,
  viewer: SupportViewer,
  transaction?: Transaction
): Promise<SupportTicket> => {
  const ticket = await SupportTicket.findByPk(ticketId, {
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
  // A ticket of someone else answers like one that does not exist.
  if (!ticket || !canViewSupportTicket(ticket, viewer)) throw notFound();
  return ticket;
};

interface NewTicket {
  title: unknown;
  description?: unknown;
  category?: unknown;
  priority?: unknown;
  location?: unknown;
  screen?: unknown;
  appUrl?: unknown;
  userAgent?: unknown;
  attachments: SupportAttachment[];
}

export const createSupportTicket = async (
  viewer: SupportViewer,
  input: NewTicket
) => {
  const fields = {
    title: supportText(input.title, SUPPORT_TITLE_MAX, true),
    description: supportText(input.description, SUPPORT_BODY_MAX, false),
    category: supportOption(input.category, SUPPORT_CATEGORIES, "other"),
    priority: supportOption(input.priority, SUPPORT_PRIORITIES, "medium"),
    location: supportText(input.location, SUPPORT_LOCATION_MAX, false),
    screen: supportText(input.screen, 40, false),
    appUrl: supportText(input.appUrl, 255, false),
    userAgent:
      typeof input.userAgent === "string"
        ? supportText(input.userAgent.slice(0, 500), 500, false)
        : ""
  };

  const recent = await SupportTicket.count({
    where: {
      userId: viewer.userId,
      createdAt: { [Op.gt]: new Date(Date.now() - HOUR) }
    }
  });
  if (recent >= SUPPORT_TICKETS_PER_HOUR)
    throw new AppError("ERR_SUPPORT_RATE_LIMIT", 429);

  const user = await User.findOne({
    where: { id: viewer.userId, companyId: viewer.companyId },
    attributes: ["id", "name", "email", "profile"]
  });
  if (!user) throw new AppError("ERR_NO_PERMISSION", 403);
  const company = await Company.findByPk(viewer.companyId, {
    attributes: ["id", "name"]
  });

  const now = new Date();
  const ticket = await SupportTicket.sequelize.transaction(
    async transaction => {
      const created = await SupportTicket.create(
        {
          companyId: viewer.companyId,
          userId: viewer.userId,
          companyName: company?.name || null,
          userName: user.name,
          userEmail: user.email,
          userProfile: user.profile,
          title: fields.title,
          category: fields.category,
          priority: fields.priority,
          status: "open",
          location: fields.location || null,
          screen: fields.screen || null,
          appUrl: fields.appUrl || null,
          userAgent: fields.userAgent || null,
          lastMessageAt: now,
          lastRequesterMessageAt: now,
          requesterReadAt: now
        } as SupportTicket,
        { transaction }
      );
      if (fields.description || input.attachments.length)
        await SupportMessage.create(
          {
            ticketId: created.id,
            userId: viewer.userId,
            userName: user.name,
            fromSupport: false,
            kind: "message",
            body: fields.description || null,
            attachments: input.attachments
          } as SupportMessage,
          { transaction }
        );
      return created;
    }
  );

  emitSupportTicket(ticket, "create");
  return supportTicketView(ticket, viewer);
};

const likeText = (text: string): string =>
  `%${text.replace(/[\\%_]/g, "\\$&")}%`;

export const listSupportTickets = async (
  viewer: SupportViewer,
  { scope, search }: { scope?: unknown; search?: unknown }
) => {
  const queue = scope === "queue";
  if (queue && !viewer.isSuper) throw new AppError("ERR_NO_PERMISSION", 403);

  const text = supportText(search, 100, false);
  const number = /^(?:ch-?)?0*([1-9]\d{0,9})$/i.exec(text);
  const where: WhereOptions = {
    ...(queue ? {} : { userId: viewer.userId }),
    ...(text
      ? {
          [Op.or]: [
            { title: { [Op.iLike]: likeText(text) } },
            ...(queue
              ? [
                  { userName: { [Op.iLike]: likeText(text) } },
                  { companyName: { [Op.iLike]: likeText(text) } }
                ]
              : []),
            ...(number ? [{ id: Number(number[1]) }] : [])
          ]
        }
      : {})
  };

  const tickets = await SupportTicket.findAll({
    where,
    order: [
      // Tickets still going first; among them, the latest conversation first.
      literal(`CASE WHEN "status" IN ('done', 'cancelled') THEN 1 ELSE 0 END`),
      ["lastMessageAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: LIST_LIMIT
  });
  return tickets.map(ticket => supportTicketView(ticket, viewer));
};

export const showSupportTicket = async (
  viewer: SupportViewer,
  ticketId: number
) => {
  const ticket = await findVisible(ticketId, viewer);
  const messages = await SupportMessage.findAll({
    where: { ticketId },
    order: [["id", "ASC"]]
  });
  return {
    ticket: supportTicketView(ticket, viewer),
    messages: messages.map(message => supportMessageView(message, viewer))
  };
};

interface Entry {
  kind: "message" | "event";
  event?: string;
  body?: string | null;
  attachments?: SupportAttachment[];
}

// Stores the entries of one action and moves the ticket's clocks: who wrote
// last, who still has to read, and when it was finished.
const record = async (
  ticket: SupportTicket,
  viewer: SupportViewer,
  name: string,
  fromSupport: boolean,
  status: SupportStatus,
  assign: boolean,
  entries: Entry[],
  transaction: Transaction
): Promise<void> => {
  const now = new Date();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    // In order: the conversation reads top to bottom by id.

    await SupportMessage.create(
      {
        ticketId: ticket.id,
        userId: viewer.userId,
        userName: name,
        fromSupport,
        kind: entry.kind,
        event: entry.event || null,
        body: entry.body || null,
        attachments: entry.attachments || []
      } as SupportMessage,
      { transaction }
    );
  }
  await ticket.update(
    {
      status,
      lastMessageAt: now,
      ...(fromSupport
        ? { lastSupportMessageAt: now, supportReadAt: now }
        : { lastRequesterMessageAt: now, requesterReadAt: now }),
      ...(assign
        ? { assignedUserId: viewer.userId, assignedUserName: name }
        : {}),
      finishedAt: isSupportFinished(status) ? ticket.finishedAt || now : null
    },
    { transaction }
  );
};

export const createSupportMessage = async (
  viewer: SupportViewer,
  ticketId: number,
  input: { body?: unknown; attachments: SupportAttachment[] }
) => {
  const body = supportText(input.body, SUPPORT_BODY_MAX, false);
  if (!body && !input.attachments.length)
    throw new AppError("ERR_SUPPORT_INVALID", 400);

  const recent = await SupportMessage.count({
    where: {
      userId: viewer.userId,
      kind: "message",
      createdAt: { [Op.gt]: new Date(Date.now() - HOUR) }
    }
  });
  if (recent >= SUPPORT_MESSAGES_PER_HOUR)
    throw new AppError("ERR_SUPPORT_RATE_LIMIT", 429);

  const name = await actorName(viewer);
  const ticket = await SupportTicket.sequelize.transaction(
    async transaction => {
      const locked = await findVisible(ticketId, viewer, transaction);
      const fromSupport = actsAsSupport(locked, viewer);
      const before = locked.status as SupportStatus;
      const { status, reopened } = supportStatusAfterMessage({
        status: before,
        fromSupport,
        hasAssignee: !!locked.assignedUserId
      });
      const entries: Entry[] = [];
      if (reopened) entries.push({ kind: "event", event: "reopened" });
      else if (fromSupport && before === "open")
        entries.push({ kind: "event", event: "taken" });
      else if (!fromSupport && before === "waiting")
        entries.push({ kind: "event", event: "resumed" });
      entries.push({ kind: "message", body, attachments: input.attachments });
      await record(
        locked,
        viewer,
        name,
        fromSupport,
        status,
        fromSupport && !locked.assignedUserId,
        entries,
        transaction
      );
      return locked;
    }
  );

  emitSupportTicket(ticket, "message");
  return showSupportTicket(viewer, ticketId);
};

const EVENT_OF_ACTION: Record<string, string> = {
  take: "taken",
  request_info: "waiting",
  resume: "resumed",
  conclude: "done",
  reopen: "reopened",
  cancel: "cancelled"
};

export const runSupportAction = async (
  viewer: SupportViewer,
  ticketId: number,
  input: { action?: unknown; text?: unknown }
) => {
  const action = supportOption(input.action, SUPPORT_ACTIONS);
  const text = supportText(input.text, SUPPORT_BODY_MAX, false);
  const name = await actorName(viewer);

  const ticket = await SupportTicket.sequelize.transaction(
    async transaction => {
      const locked = await findVisible(ticketId, viewer, transaction);
      const isRequester = isSupportRequester(locked, viewer);
      const result = supportActionResult({
        action,
        status: locked.status as SupportStatus,
        isSupport: viewer.isSuper,
        isRequester
      });
      // Concluding, cancelling and asking for information need a reason,
      // which becomes part of the conversation.
      if (result.needsText && !text)
        throw new AppError("ERR_SUPPORT_TEXT_REQUIRED", 400);
      const fromSupport = actsAsSupport(locked, viewer);
      const assign =
        fromSupport &&
        (result.assign === "always" ||
          (result.assign === "if-empty" && !locked.assignedUserId));
      await record(
        locked,
        viewer,
        name,
        fromSupport,
        result.status,
        assign,
        [{ kind: "event", event: EVENT_OF_ACTION[action], body: text }],
        transaction
      );
      return locked;
    }
  );

  emitSupportTicket(ticket, "status");
  return showSupportTicket(viewer, ticketId);
};

export const markSupportTicketRead = async (
  viewer: SupportViewer,
  ticketId: number
): Promise<void> => {
  const ticket = await findVisible(ticketId, viewer);
  await ticket.update(
    isSupportRequester(ticket, viewer)
      ? { requesterReadAt: new Date() }
      : { supportReadAt: new Date() }
  );
  emitSupportTicket(ticket, "read");
};

const unreadWhere = (moment: string, read: string): WhereOptions => ({
  [moment]: { [Op.ne]: null },
  [Op.or]: [{ [read]: null }, { [moment]: { [Op.gt]: col(read) } }]
});

/** Numbers for the badge of the menu and the summary of the queue. */
export const supportSummary = async (viewer: SupportViewer) => {
  const mineUnread = await SupportTicket.count({
    where: {
      userId: viewer.userId,
      ...unreadWhere("lastSupportMessageAt", "requesterReadAt")
    }
  });
  if (!viewer.isSuper) return { unread: mineUnread, mineUnread };

  const notMine: WhereOptions = {
    [Op.or]: [{ userId: null }, { userId: { [Op.ne]: viewer.userId } }]
  };
  const [queueUnread, open, unassigned, inProgress, waiting] =
    await Promise.all([
      SupportTicket.count({
        where: {
          [Op.and]: [
            notMine,
            unreadWhere("lastRequesterMessageAt", "supportReadAt")
          ]
        }
      }),
      SupportTicket.count({ where: { status: "open" } }),
      SupportTicket.count({
        where: {
          status: { [Op.notIn]: ["done", "cancelled"] },
          assignedUserId: null
        }
      }),
      SupportTicket.count({ where: { status: "in_progress" } }),
      SupportTicket.count({ where: { status: "waiting" } })
    ]);
  return {
    unread: mineUnread + queueUnread,
    mineUnread,
    queueUnread,
    queue: { open, unassigned, inProgress, waiting }
  };
};

export const supportAttachmentFile = async (
  viewer: SupportViewer,
  ticketId: number,
  storedName: string
): Promise<{ filePath: string; attachment: SupportAttachment }> => {
  await findVisible(ticketId, viewer);
  const filePath = supportFilePath(storedName);
  if (!filePath) throw notFound();
  // The file must belong to a message of this very ticket.
  const messages = await SupportMessage.findAll({
    where: { ticketId },
    attributes: ["id", "attachments"]
  });
  const attachment = messages
    .flatMap(message => message.attachments || [])
    .find(file => file.storedName === storedName);
  if (!attachment) throw notFound();
  return { filePath, attachment };
};
