import AppError from "../errors/AppError";

export const ASSISTANT_LIMITS = { maxMessages: 30, maxCharacters: 12000 };
export type AssistantKind = "summary" | "reply";
export interface AssistantScope {
  companyId: number;
  ticketId: number;
  contactId: number;
  isGroup: boolean;
}
export interface AssistantSource {
  id: string;
  companyId: number;
  ticketId: number;
  contactId: number | null;
  senderCompanyId?: number;
  body: string;
  fromMe: boolean;
  isDeleted: boolean;
  mediaType: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  bodyTruncated?: boolean;
}
export interface AssistantMessage {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AssistantContext {
  messages: AssistantMessage[];
  messageCount: number;
  characterCount: number;
  partial: boolean;
  maxMessages: number;
  maxCharacters: number;
}
export interface AssistantOutput {
  kind: AssistantKind;
  text: string;
  references: { messageId: string; excerpt: string }[];
}

export const parseAssistantRequest = (input: unknown): AssistantKind => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "kind") ||
    !["summary", "reply"].includes((input as { kind: string }).kind)
  ) {
    throw new AppError("ERR_ASSISTANT_INVALID_REQUEST", 400);
  }
  return (input as { kind: AssistantKind }).kind;
};

export const assistantMode = (): "disabled" | "mock" =>
  process.env.AI_ASSISTANT_MODE === "mock" ? "mock" : "disabled";

const sourceEligible = (
  row: AssistantSource,
  scope: AssistantScope
): boolean => {
  const sameSender = scope.isGroup
    ? row.senderCompanyId === scope.companyId
    : row.contactId === scope.contactId;
  return (
    row.companyId === scope.companyId &&
    row.ticketId === scope.ticketId &&
    (sameSender || (row.fromMe === true && row.contactId === null)) &&
    row.isDeleted === false &&
    [null, "conversation", "extendedTextMessage"].includes(row.mediaType) &&
    !row.mediaUrl &&
    !row.thumbnailUrl &&
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.body === "string"
  );
};

// Select the latest bounded text window. Media captions and internal notes never enter it.
export const buildAssistantContext = (
  rows: AssistantSource[],
  scope: AssistantScope
): AssistantContext => {
  const messages: AssistantMessage[] = [];
  let characterCount = 0;
  let partial = rows.length > ASSISTANT_LIMITS.maxMessages;
  const sources = rows
    .filter(row => sourceEligible(row, scope))
    .sort((a, b) => {
      const date =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return date || b.id.localeCompare(a.id);
    });
  sources.forEach(source => {
    if (source.bodyTruncated) partial = true;
    const body = source.body.replace(/\s+/g, " ").trim();
    if (!body) return;
    if (
      messages.length >= ASSISTANT_LIMITS.maxMessages ||
      characterCount >= ASSISTANT_LIMITS.maxCharacters
    ) {
      partial = true;
      return;
    }
    const text = body.slice(0, ASSISTANT_LIMITS.maxCharacters - characterCount);
    if (text.length < body.length) partial = true;
    messages.push({
      id: source.id,
      body: text,
      fromMe: source.fromMe === true,
      createdAt: new Date(source.createdAt).toISOString(),
      updatedAt: new Date(source.updatedAt).toISOString()
    });
    characterCount += text.length;
  });
  messages.reverse();
  return {
    messages,
    messageCount: messages.length,
    characterCount,
    partial,
    ...ASSISTANT_LIMITS
  };
};

export const MOCK_REPLY =
  "Obrigado pelo contato. Para responder com segurança, preciso de mais informações sobre sua solicitação.";
export const MOCK_EMPTY_SUMMARY =
  "Não há mensagens de texto elegíveis neste atendimento para preparar um resumo.";

// This mock quotes data; it never interprets messages as instructions or asserts external facts.
export const createMockAssistantOutput = (
  kind: AssistantKind,
  messages: AssistantMessage[]
): AssistantOutput => {
  const selected =
    kind === "summary"
      ? messages.slice(-6)
      : messages.filter(message => !message.fromMe).slice(-1);
  const references = selected.map(message => ({
    messageId: message.id,
    excerpt: message.body.slice(0, 320)
  }));
  const text =
    kind === "reply"
      ? MOCK_REPLY
      : selected.length
        ? selected
            .map(
              (message, index) =>
                `${message.fromMe ? "Mensagem enviada" : "Mensagem recebida"} (citação): ${JSON.stringify(references[index].excerpt)}`
            )
            .join("\n")
        : MOCK_EMPTY_SUMMARY;
  return { kind, text, references };
};

// Mock-only allowlist: even a malformed or tampered provider cannot add a fact or foreign reference.
export const validateAssistantOutput = (
  output: unknown,
  kind: AssistantKind,
  messages: AssistantMessage[]
): AssistantOutput => {
  const expected = createMockAssistantOutput(kind, messages);
  const candidate = output as AssistantOutput;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    Object.keys(candidate).sort().join(",") !== "kind,references,text" ||
    candidate.kind !== kind ||
    candidate.text !== expected.text ||
    !Array.isArray(candidate.references) ||
    JSON.stringify(candidate.references) !== JSON.stringify(expected.references)
  ) {
    throw new AppError("ERR_ASSISTANT_INVALID_OUTPUT", 502);
  }
  return expected;
};
