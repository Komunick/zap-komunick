export interface MessageQuotePayload {
  dataJson?: string | null;
  quotedMsg?: MessageQuotePayload | null;
  replies?: MessageQuotePayload[];
}

function quoteContent(dataJson?: string | null): string | undefined {
  if (!dataJson) return undefined;
  try {
    const payload = JSON.parse(dataJson);
    return JSON.stringify(payload?.message ?? payload);
  } catch {
    return undefined;
  }
}

function redactUnverifiedQuote(
  dataJson?: string | null,
  authorizedQuote?: MessageQuotePayload | null
): string | null | undefined {
  if (!dataJson?.includes('"quotedMessage"')) return dataJson;
  const allowed = quoteContent(authorizedQuote?.dataJson);
  try {
    // The protocol's embedded copy has no ticket identity. Keep it only when
    // it matches content already authorized through the message relation.
    return JSON.stringify(
      JSON.parse(dataJson, (key, value) =>
        key === "quotedMessage" &&
        (!allowed || JSON.stringify(value) !== allowed)
          ? undefined
          : value
      )
    );
  } catch {
    return null;
  }
}

export function sanitizeMessageQuotePayload<
  Payload extends MessageQuotePayload
>(message: Payload): Payload {
  const quotedMsg = message.quotedMsg
    ? sanitizeMessageQuotePayload(message.quotedMsg)
    : message.quotedMsg;
  const dataJson = redactUnverifiedQuote(message.dataJson, quotedMsg);
  return {
    ...message,
    ...(dataJson !== message.dataJson && { dataJson }),
    ...(quotedMsg && { quotedMsg }),
    ...(message.replies && {
      replies: message.replies.map(sanitizeMessageQuotePayload)
    })
  };
}
