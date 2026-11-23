// Zap Komunick: what the history dividers show about each ticket of the
// client (docs/PRD.md, RF-027). Only names and dates: no message content.

export interface HistoryTicketFacts {
  id: number;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  queue?: { id: number; name: string; color?: string } | null;
  whatsapp?: { id: number; name: string; status?: string } | null;
  user?: { id: number; name: string } | null;
}

export interface HistoryTicketSummary {
  id: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  queue: { id: number; name: string; color: string | null } | null;
  whatsapp: { id: number; name: string; connected: boolean } | null;
  user: { id: number; name: string } | null;
}

const toIso = (value: Date | string): string | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function summarizeHistoryTicket(
  ticket: HistoryTicketFacts
): HistoryTicketSummary {
  return {
    id: ticket.id,
    status: ticket.status,
    createdAt: toIso(ticket.createdAt),
    updatedAt: toIso(ticket.updatedAt),
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
    user: ticket.user ? { id: ticket.user.id, name: ticket.user.name } : null
  };
}
