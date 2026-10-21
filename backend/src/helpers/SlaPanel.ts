import { classifySla, SlaConfig, SlaSituation } from "./SlaRules";

// Zap Komunick: SLA panel aggregation (docs/PRD.md, RF-002)

export interface SlaPanelTicket {
  id: number;
  uuid?: string;
  status: string;
  isGroup: boolean;
  chatbot?: boolean | null;
  unansweredSince?: Date | string | null;
  openedAt?: Date | string | null;
  contact?: { id: number; name: string; number?: string } | null;
  queue?: { id: number; name: string; color?: string } | null;
  user?: { id: number; name: string } | null;
}

export interface SlaPanelRow {
  id: number;
  uuid?: string;
  status: string;
  isGroup: boolean;
  contact: SlaPanelTicket["contact"];
  queue: SlaPanelTicket["queue"];
  user: SlaPanelTicket["user"];
  unansweredSince: Date | string | null;
  openedAt: Date | string | null;
  waiting: boolean;
  waitingMinutes: number | null;
  situation: SlaSituation;
}

interface GroupCounter {
  total: number;
  waiting: number;
  breached: number;
  old: number;
}

export interface SlaPanel {
  config: SlaConfig;
  generatedAt: string;
  totals: {
    total: number;
    pending: number;
    open: number;
    breached: number;
    old: number;
    waitingClients: number;
    groups: number;
    waitingGroups: number;
  };
  byQueue: Array<
    GroupCounter & {
      queueId: number | null;
      name: string | null;
      color: string | null;
    }
  >;
  byUser: Array<GroupCounter & { userId: number | null; name: string | null }>;
  tickets: SlaPanelRow[];
}

const situationWeight: Record<SlaSituation, number> = {
  breached: 0,
  old: 1,
  ok: 2
};

const emptyCounter = (): GroupCounter => ({
  total: 0,
  waiting: 0,
  breached: 0,
  old: 0
});

const count = (counter: GroupCounter, row: SlaPanelRow) => {
  counter.total += 1;
  if (row.waiting) counter.waiting += 1;
  if (row.situation === "breached") counter.breached += 1;
  if (row.situation === "old") counter.old += 1;
};

export function buildSlaPanel(
  tickets: SlaPanelTicket[],
  config: SlaConfig,
  now: Date = new Date()
): SlaPanel {
  const rows: SlaPanelRow[] = tickets
    .filter(ticket => ["open", "pending"].includes(ticket.status))
    .map(ticket => {
      const sla = classifySla(ticket, config, now);
      return {
        id: ticket.id,
        uuid: ticket.uuid,
        status: ticket.status,
        isGroup: !!ticket.isGroup,
        contact: ticket.contact || null,
        queue: ticket.queue || null,
        user: ticket.user || null,
        unansweredSince: ticket.unansweredSince || null,
        openedAt: ticket.openedAt || null,
        waiting: sla.waiting,
        waitingMinutes: sla.waitingMinutes,
        situation: sla.situation
      };
    });

  const totals = {
    total: rows.length,
    pending: rows.filter(row => row.status === "pending").length,
    open: rows.filter(row => row.status === "open").length,
    breached: rows.filter(row => row.situation === "breached").length,
    old: rows.filter(row => row.situation === "old").length,
    waitingClients: rows.filter(row => row.waiting && !row.isGroup).length,
    groups: rows.filter(row => row.isGroup).length,
    waitingGroups: rows.filter(row => row.waiting && row.isGroup).length
  };

  const queues = new Map<number | null, SlaPanel["byQueue"][number]>();
  const users = new Map<number | null, SlaPanel["byUser"][number]>();

  rows.forEach(row => {
    const queueId = row.queue?.id ?? null;
    if (!queues.has(queueId)) {
      queues.set(queueId, {
        queueId,
        name: row.queue?.name ?? null,
        color: row.queue?.color ?? null,
        ...emptyCounter()
      });
    }
    count(queues.get(queueId), row);

    const userId = row.user?.id ?? null;
    if (!users.has(userId)) {
      users.set(userId, {
        userId,
        name: row.user?.name ?? null,
        ...emptyCounter()
      });
    }
    count(users.get(userId), row);
  });

  const byPressure = (a: GroupCounter, b: GroupCounter) =>
    b.breached - a.breached || b.waiting - a.waiting || b.total - a.total;

  const sortedRows = [...rows].sort(
    (a, b) =>
      situationWeight[a.situation] - situationWeight[b.situation] ||
      (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) ||
      a.id - b.id
  );

  return {
    config,
    generatedAt: now.toISOString(),
    totals,
    byQueue: [...queues.values()].sort(byPressure),
    byUser: [...users.values()].sort(byPressure),
    tickets: sortedRows
  };
}
