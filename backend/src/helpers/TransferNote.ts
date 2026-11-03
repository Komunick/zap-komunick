// Zap Komunick: context that goes with a transfer (docs/PRD.md, RF-017). An
// internal note in the conversation, never sent to the client: the text of
// whoever transfers and a copy of the messages they picked.

export const TRANSFER_NOTE_TYPE = "transferNote";
export const MAX_NOTE_LENGTH = 2000;
export const MAX_NOTE_MESSAGES = 30;
export const MAX_QUOTE_LENGTH = 500;

export interface NoteInput {
  note?: unknown;
  messageIds?: unknown;
}

export interface ParsedNote {
  note: string;
  messageIds: string[];
}

/** null when there is nothing to record (no text and no message picked). */
export function parseTransferNote(input: NoteInput): ParsedNote | null {
  const note = String(input.note ?? "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);
  const messageIds = Array.isArray(input.messageIds)
    ? Array.from(
        new Set(
          input.messageIds
            .filter(
              id => typeof id === "string" && id.length > 0 && id.length <= 255
            )
            .map(String)
        )
      ).slice(0, MAX_NOTE_MESSAGES)
    : [];
  if (!note && messageIds.length === 0) {
    return null;
  }
  return { note, messageIds };
}

export interface QuotedSource {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  createdAt: Date | string;
  senderName?: string | null;
}

export interface QuotedMessage {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
  senderName: string | null;
}

/** Copies the picked messages in time order, text only and shortened. */
export function quoteMessages(sources: QuotedSource[]): QuotedMessage[] {
  return [...sources]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map(source => {
      const text = (source.body || "").trim();
      const body =
        text ||
        (source.mediaType && source.mediaType !== "conversation"
          ? `[${source.mediaType}]`
          : "");
      return {
        id: source.id,
        fromMe: !!source.fromMe,
        body:
          body.length > MAX_QUOTE_LENGTH
            ? `${body.slice(0, MAX_QUOTE_LENGTH)}…`
            : body,
        createdAt: new Date(source.createdAt).toISOString(),
        senderName: source.senderName || null
      };
    });
}

/** Text used in places that only show the body (search, export). */
export function noteBody(note: string, quotes: QuotedMessage[]): string {
  const lines = [note || "Transferência com mensagens destacadas"];
  quotes.forEach(q => lines.push(`> ${q.body}`));
  return lines.join("\n");
}
