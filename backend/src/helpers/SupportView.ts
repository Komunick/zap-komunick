import { supportNumber } from "./SupportRules";

// Zap Komunick: what each side sees of a support ticket (RF-030). Support is
// any super administrator of the installation; the requester is the user who
// opened the ticket.
export interface SupportViewer {
  userId: number;
  companyId: number;
  isSuper: boolean;
}

export interface SupportTicketData {
  id: number;
  companyId?: number | null;
  userId?: number | null;
  companyName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userProfile?: string | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  location?: string | null;
  userAgent?: string | null;
  screen?: string | null;
  appUrl?: string | null;
  assignedUserId?: number | null;
  assignedUserName?: string | null;
  lastMessageAt?: Date | null;
  lastRequesterMessageAt?: Date | null;
  lastSupportMessageAt?: Date | null;
  requesterReadAt?: Date | null;
  supportReadAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
}

export interface SupportMessageData {
  id: number;
  ticketId: number;
  userId?: number | null;
  userName?: string | null;
  fromSupport: boolean;
  kind: string;
  event?: string | null;
  body?: string | null;
  attachments?: {
    storedName: string;
    originalName: string;
    mimeType: string;
    size: number;
  }[];
  createdAt: Date;
}

export const isSupportRequester = (
  ticket: Pick<SupportTicketData, "userId">,
  viewer: SupportViewer
): boolean => !!ticket.userId && ticket.userId === viewer.userId;

/** The requester always sees the own ticket; support sees every ticket. */
export const canViewSupportTicket = (
  ticket: Pick<SupportTicketData, "userId">,
  viewer: SupportViewer
): boolean => viewer.isSuper || isSupportRequester(ticket, viewer);

/** A super administrator answers as support, except in a ticket of their own. */
export const actsAsSupport = (
  ticket: Pick<SupportTicketData, "userId">,
  viewer: SupportViewer
): boolean => viewer.isSuper && !isSupportRequester(ticket, viewer);

const after = (moment?: Date | null, read?: Date | null): boolean =>
  !!moment && (!read || new Date(moment).getTime() > new Date(read).getTime());

/** Whether the other side wrote or acted after this side last opened it. */
export const supportUnread = (
  ticket: SupportTicketData,
  viewer: SupportViewer
): boolean =>
  isSupportRequester(ticket, viewer)
    ? after(ticket.lastSupportMessageAt, ticket.requesterReadAt)
    : after(ticket.lastRequesterMessageAt, ticket.supportReadAt);

export const supportTicketView = (
  ticket: SupportTicketData,
  viewer: SupportViewer
) => ({
  id: ticket.id,
  number: supportNumber(ticket.id),
  title: ticket.title,
  category: ticket.category,
  priority: ticket.priority,
  status: ticket.status,
  location: ticket.location || null,
  userId: ticket.userId ?? null,
  userName: ticket.userName || null,
  companyId: ticket.companyId ?? null,
  companyName: ticket.companyName || null,
  assignedUserName: ticket.assignedUserName || null,
  lastMessageAt: ticket.lastMessageAt || ticket.createdAt,
  finishedAt: ticket.finishedAt || null,
  createdAt: ticket.createdAt,
  mine: isSupportRequester(ticket, viewer),
  unread: supportUnread(ticket, viewer),
  // Technical context and contact of the requester: only for who answers.
  ...(viewer.isSuper
    ? {
        userEmail: ticket.userEmail || null,
        userProfile: ticket.userProfile || null,
        userAgent: ticket.userAgent || null,
        screen: ticket.screen || null,
        appUrl: ticket.appUrl || null
      }
    : {})
});

export const supportMessageView = (
  message: SupportMessageData,
  viewer: SupportViewer
) => ({
  id: message.id,
  ticketId: message.ticketId,
  userName: message.userName || null,
  fromSupport: message.fromSupport,
  mine: !!message.userId && message.userId === viewer.userId,
  kind: message.kind,
  event: message.event || null,
  body: message.body || "",
  attachments: (message.attachments || []).map(file => ({
    id: file.storedName,
    name: file.originalName,
    mimeType: file.mimeType,
    size: file.size
  })),
  createdAt: message.createdAt
});
