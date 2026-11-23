// Zap Komunick: brings the conversation history of the previous system
// (ZapContábil, also called Zappy) into SuperChat as closed tickets, so the
// team sees what the client said before (docs/PRD.md, RF-029).
//
// Pure rules: no database. The script in scripts/importZappyHistory.ts reads
// the export, asks these functions what to do and writes the result.
import normalizePhone from "./NormalizePhone";

/** One message of the export, in the shape the extractor writes. */
export interface ExportedMessage {
  /** Id of the message in the previous system. */
  externalId: string;
  /** WhatsApp key id, when known. Same id SuperChat stores. */
  whatsappId?: string | null;
  fromMe: boolean;
  body?: string | null;
  /** ISO date. */
  createdAt: string;
  mediaType?: string | null;
  fileName?: string | null;
  /** Agent name for messages sent by the team. */
  senderName?: string | null;
}

export interface ExportedTicket {
  externalId: string;
  contactNumber: string;
  contactName?: string | null;
  isGroup?: boolean;
  queueName?: string | null;
  userName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  messages: ExportedMessage[];
}

export interface HistoryExport {
  source: "zapcontabil";
  exportedAt: string;
  tickets: ExportedTicket[];
}

export interface ImportContext {
  /** Contact id by every stored form of the number. */
  contactIdByNumber: Map<string, number>;
  /** Queue id by lower-case name. */
  queueIdByName: Map<string, number>;
  /** User id by lower-case name. */
  userIdByName: Map<string, number>;
  /** Message ids that already exist in the company. */
  existingMessageIds: Set<string>;
}

export interface PlannedMessage {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: Date;
}

export interface PlannedTicket {
  externalId: string;
  contact: { id: number } | { create: { name: string; number: string } };
  queueId: number | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
  messages: PlannedMessage[];
  /** Messages left out because SuperChat already has them. */
  alreadyPresent: number;
}

export interface ImportPlan {
  tickets: PlannedTicket[];
  skipped: Array<{ externalId: string; reason: string }>;
  totals: {
    tickets: number;
    messages: number;
    alreadyPresent: number;
    newContacts: number;
  };
}

/** The forms a Brazilian WhatsApp number may be stored with. */
export function numberCandidates(raw: string): string[] {
  const digits = String(raw || "")
    .split("@")[0]
    .replace(/\D/g, "");
  if (!digits) return [];
  const { phone, wphone } = normalizePhone(digits);
  return Array.from(new Set([digits, phone, wphone]));
}

const validDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Id of the message in SuperChat: the WhatsApp id when the export has it (so
 * a message both systems received is not repeated), otherwise a prefixed id
 * that keeps a second run from importing it again.
 */
export function importedMessageId(message: ExportedMessage): string {
  const whatsappId = (message.whatsappId || "").trim();
  if (whatsappId) return whatsappId;
  return `zappy-${String(message.externalId).trim()}`;
}

/** Text of the message; attachments stay as their name (text-only import). */
export function importedMessageBody(message: ExportedMessage): string {
  const text = (message.body || "").trim();
  const fileName = (message.fileName || "").trim();
  const media = (message.mediaType || "").trim();
  if (media && media !== "chat" && media !== "conversation") {
    const label = fileName || media;
    if (text && text !== fileName) return `📎 ${label}\n${text}`;
    return `📎 ${label}`;
  }
  return text;
}

export function planImport(
  data: HistoryExport,
  context: ImportContext
): ImportPlan {
  if (data?.source !== "zapcontabil" || !Array.isArray(data.tickets)) {
    throw new Error("ERR_IMPORT_INVALID_EXPORT");
  }

  const tickets: PlannedTicket[] = [];
  const skipped: ImportPlan["skipped"] = [];
  const seenIds = new Set(context.existingMessageIds);
  const newNumbers = new Set<string>();
  let alreadyPresentTotal = 0;

  data.tickets.forEach(ticket => {
    if (ticket.isGroup) {
      skipped.push({ externalId: ticket.externalId, reason: "group" });
      return;
    }
    const candidates = numberCandidates(ticket.contactNumber);
    if (!candidates.length) {
      skipped.push({ externalId: ticket.externalId, reason: "no-number" });
      return;
    }

    let alreadyPresent = 0;
    const messages: PlannedMessage[] = [];
    (ticket.messages || []).forEach(message => {
      const createdAt = validDate(message.createdAt);
      const body = importedMessageBody(message);
      if (!createdAt || !body) return;
      const id = importedMessageId(message);
      if (seenIds.has(id)) {
        alreadyPresent += 1;
        return;
      }
      seenIds.add(id);
      messages.push({ id, body, fromMe: !!message.fromMe, createdAt });
    });
    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    alreadyPresentTotal += alreadyPresent;

    if (!messages.length) {
      skipped.push({
        externalId: ticket.externalId,
        reason: alreadyPresent ? "already-imported" : "no-messages"
      });
      return;
    }

    const existingContact = candidates
      .map(number => context.contactIdByNumber.get(number))
      .find(id => id !== undefined);
    // new contacts keep the ninth digit, as SuperChat stores them
    const number = normalizePhone(candidates[0]).phone;
    if (existingContact === undefined) newNumbers.add(number);

    const first = messages[0].createdAt;
    const last = messages[messages.length - 1].createdAt;
    tickets.push({
      externalId: ticket.externalId,
      contact:
        existingContact !== undefined
          ? { id: existingContact }
          : {
              create: {
                name: (ticket.contactName || "").trim() || number,
                number
              }
            },
      queueId:
        context.queueIdByName.get(
          (ticket.queueName || "").trim().toLowerCase()
        ) ?? null,
      userId:
        context.userIdByName.get(
          (ticket.userName || "").trim().toLowerCase()
        ) ?? null,
      createdAt: validDate(ticket.createdAt) || first,
      updatedAt: last,
      messages,
      alreadyPresent
    });
  });

  return {
    tickets,
    skipped,
    totals: {
      tickets: tickets.length,
      messages: tickets.reduce((sum, t) => sum + t.messages.length, 0),
      alreadyPresent: alreadyPresentTotal,
      newContacts: newNumbers.size
    }
  };
}
