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
  /** Queue id by lower-case name of the previous system (explicit map). */
  queueIdByName: Map<string, number>;
  /** Queue for tickets whose queue name is not in the map. */
  defaultQueueId?: number | null;
  /** User id by lower-case name. */
  userIdByName: Map<string, number>;
  /** Message ids that already exist in the company. */
  existingMessageIds: Set<string>;
  /**
   * From this moment on SuperChat also receives the number: a message after
   * it is imported only when it has the WhatsApp id (the only safe way to
   * know it is not already there).
   */
  until?: Date | null;
}

export interface PlannedMessage {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: Date;
}

export interface PlannedTicket {
  externalId: string;
  contact:
    | { id: number }
    | { create: { name: string; number: string; createdAt: Date } };
  queueId: number | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
  messages: PlannedMessage[];
  /** Messages left out because SuperChat already has them. */
  alreadyPresent: number;
}

export type SkipReason =
  "group" | "lid" | "invalid-number" | "no-messages" | "already-imported";

export interface ImportPlan {
  tickets: PlannedTicket[];
  skipped: Array<{ externalId: string; reason: SkipReason }>;
  /** Names without a match, for the operator to map (names only). */
  unmatchedQueues: string[];
  unmatchedUsers: string[];
  totals: {
    tickets: number;
    messages: number;
    alreadyPresent: number;
    newContacts: number;
    /** Messages after `until` without WhatsApp id, left out. */
    afterCutoffWithoutWhatsappId: number;
    /** Messages the export has but that cannot be imported, by reason. */
    dropped: { invalidDate: number; empty: number; noId: number };
  };
}

/** How queue and agent names are compared. */
export const nameKey = (name: string): string =>
  String(name || "")
    .trim()
    .toLowerCase();

/**
 * Id by name. A name two rows share is ambiguous: it stays out of the map, so
 * the ticket is never given to the wrong queue or agent without a warning.
 */
export function indexByName(rows: Array<{ id: number; name: string }>): {
  idByName: Map<string, number>;
  ambiguous: Set<string>;
} {
  const idByName = new Map<string, number>();
  const ambiguous = new Set<string>();
  rows.forEach(row => {
    const key = nameKey(row.name);
    if (!key || ambiguous.has(key)) return;
    if (idByName.has(key) && idByName.get(key) !== row.id) {
      idByName.delete(key);
      ambiguous.add(key);
      return;
    }
    idByName.set(key, row.id);
  });
  return { idByName, ambiguous };
}

/** Refuses a file that is not an export, before anything else reads it. */
export function assertHistoryExport(
  data: unknown
): asserts data is HistoryExport {
  const candidate = data as HistoryExport;
  if (
    candidate?.source !== "zapcontabil" ||
    !Array.isArray(candidate.tickets) ||
    candidate.tickets.some(ticket => !ticket || typeof ticket !== "object")
  ) {
    throw new Error("ERR_IMPORT_INVALID_EXPORT");
  }
}

const digitsOf = (raw: string): string =>
  String(raw || "")
    .split("@")[0]
    .replace(/\D/g, "");

/**
 * The forms a Brazilian WhatsApp number may be stored with, in the order
 * SuperChat prefers them (with the ninth digit first).
 */
export function numberCandidates(raw: string): string[] {
  const digits = digitsOf(raw);
  if (!digits) return [];
  const { phone, wphone } = normalizePhone(digits);
  return Array.from(new Set([phone, digits, wphone]));
}

/** Why a number cannot become a client, or null when it can. */
export function numberProblem(raw: string): SkipReason | null {
  const value = String(raw || "").toLowerCase();
  if (value.includes("@g.us")) return "group";
  if (value.includes("@lid")) return "lid";
  const digits = digitsOf(value);
  // Brazilian numbers with country code: 12 or 13 digits
  if (!digits.startsWith("55") || ![12, 13].includes(digits.length)) {
    return digits.length >= 18 ? "group" : "invalid-number";
  }
  return null;
}

const validDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Every id a message may already have in SuperChat. */
export function messageIdForms(message: ExportedMessage): string[] {
  const forms: string[] = [];
  const whatsappId = String(message.whatsappId || "").trim();
  if (whatsappId) forms.push(whatsappId);
  const externalId = String(message.externalId ?? "").trim();
  if (externalId) forms.push(`zappy-${externalId}`);
  return forms;
}

/**
 * Id of the message in SuperChat: the WhatsApp id when the export has it (so
 * a message both systems received is not repeated), otherwise a prefixed id
 * that keeps a second run from importing it again.
 */
export function importedMessageId(message: ExportedMessage): string {
  return messageIdForms(message)[0] || "";
}

// Types the previous system uses for attachments ("image", "imageMessage",
// "application/pdf"...). Any other type is text: "chat", "conversation",
// "extendedTextMessage" (replies and links), "vcard", "location".
const ATTACHMENT_TYPE =
  /^(image|audio|ptt|ptv|voice|video|document|sticker|gif|file|application)/i;

/** Text of the message; attachments stay as their name (text-only import). */
export function importedMessageBody(message: ExportedMessage): string {
  const text = (message.body || "").trim();
  const fileName = (message.fileName || "").trim();
  const media = (message.mediaType || "").trim();
  if (fileName || ATTACHMENT_TYPE.test(media)) {
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
  assertHistoryExport(data);

  const tickets: PlannedTicket[] = [];
  const skipped: ImportPlan["skipped"] = [];
  const seenIds = new Set(context.existingMessageIds);
  const newContacts = new Map<string, Date>();
  const unmatchedQueues = new Set<string>();
  const unmatchedUsers = new Set<string>();
  let alreadyPresentTotal = 0;
  let afterCutoff = 0;
  const dropped = { invalidDate: 0, empty: 0, noId: 0 };

  data.tickets.forEach(ticket => {
    const problem = ticket.isGroup
      ? "group"
      : numberProblem(ticket.contactNumber);
    if (problem) {
      skipped.push({ externalId: ticket.externalId, reason: problem });
      return;
    }
    const candidates = numberCandidates(ticket.contactNumber);

    let alreadyPresent = 0;
    const messages: PlannedMessage[] = [];
    (ticket.messages || []).forEach(message => {
      const createdAt = validDate(message.createdAt);
      const body = importedMessageBody(message);
      const forms = messageIdForms(message);
      if (!createdAt || !body || !forms.length) {
        if (!forms.length) dropped.noId += 1;
        else if (!createdAt) dropped.invalidDate += 1;
        else dropped.empty += 1;
        return;
      }
      if (forms.some(form => seenIds.has(form))) {
        alreadyPresent += 1;
        return;
      }
      if (
        context.until &&
        createdAt.getTime() >= context.until.getTime() &&
        !String(message.whatsappId || "").trim()
      ) {
        afterCutoff += 1;
        return;
      }
      forms.forEach(form => seenIds.add(form));
      messages.push({
        id: forms[0],
        body,
        fromMe: !!message.fromMe,
        createdAt
      });
    });
    alreadyPresentTotal += alreadyPresent;

    if (!messages.length) {
      skipped.push({
        externalId: ticket.externalId,
        reason: alreadyPresent ? "already-imported" : "no-messages"
      });
      return;
    }

    // stable order; equal times get 1 ms apart so pagination never splits
    // or swaps them
    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 1; i < messages.length; i += 1) {
      const previous = messages[i - 1].createdAt.getTime();
      if (messages[i].createdAt.getTime() <= previous) {
        messages[i].createdAt = new Date(previous + 1);
      }
    }

    const first = messages[0].createdAt;
    const last = messages[messages.length - 1].createdAt;
    const existingContact = candidates
      .map(number => context.contactIdByNumber.get(number))
      .find(id => id !== undefined);
    // new contacts keep the ninth digit, as SuperChat stores them
    const number = candidates[0];
    if (existingContact === undefined) {
      const known = newContacts.get(number);
      if (!known || first < known) newContacts.set(number, first);
    }

    const queueName = (ticket.queueName || "").trim();
    let queueId = queueName
      ? context.queueIdByName.get(queueName.toLowerCase())
      : undefined;
    if (queueId === undefined) {
      if (queueName) unmatchedQueues.add(queueName);
      queueId = context.defaultQueueId ?? null;
    }
    const userName = (ticket.userName || "").trim();
    const userId = userName
      ? context.userIdByName.get(userName.toLowerCase())
      : undefined;
    if (userName && userId === undefined) unmatchedUsers.add(userName);

    tickets.push({
      externalId: ticket.externalId,
      contact:
        existingContact !== undefined
          ? { id: existingContact }
          : {
              create: {
                name: (ticket.contactName || "").trim() || number,
                number,
                createdAt: first
              }
            },
      queueId,
      userId: userId ?? null,
      createdAt: validDate(ticket.createdAt) || first,
      updatedAt: last,
      messages,
      alreadyPresent
    });
  });

  // a contact created once uses the first message of all its tickets
  tickets.forEach(ticket => {
    if ("create" in ticket.contact) {
      ticket.contact.create.createdAt = newContacts.get(
        ticket.contact.create.number
      );
    }
  });

  return {
    tickets,
    skipped,
    unmatchedQueues: Array.from(unmatchedQueues).sort(),
    unmatchedUsers: Array.from(unmatchedUsers).sort(),
    totals: {
      tickets: tickets.length,
      messages: tickets.reduce((sum, t) => sum + t.messages.length, 0),
      alreadyPresent: alreadyPresentTotal,
      newContacts: newContacts.size,
      afterCutoffWithoutWhatsappId: afterCutoff,
      dropped
    }
  };
}
