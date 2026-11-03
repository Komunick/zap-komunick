// Zap Komunick: Message has the composite primary key (ticketId, id).
// The client's historical tickets can legitimately contain the same platform ID.
export const messageIdentity = message =>
  String(message.ticketId) + ":" + message.id;
export const newMessagesForRefresh = (current, incoming) => {
  const ids = new Set(current.map(messageIdentity));
  return incoming.filter(message => !ids.has(messageIdentity(message)));
};
const indexOf = (messages, message) =>
  messages.findIndex(row => messageIdentity(row) === messageIdentity(message));
const upsertAtEnd = (messages, message) => {
  const next = [...messages];
  const index = indexOf(next, message);
  if (index < 0) next.push(message);
  else next[index] = message;
  return next;
};
const reactionTargetIndex = (messages, reaction) => {
  const targetId = reaction.quotedMsgId || reaction.quotedMsg?.id;
  const targetTicketId = reaction.quotedMsg?.ticketId;
  if (targetTicketId !== undefined && targetTicketId !== null) {
    return messages.findIndex(
      message =>
        message.id === targetId &&
        String(message.ticketId) === String(targetTicketId)
    );
  }
  // Legacy reactions may omit the source ticket. A unique historical ID remains
  // usable; duplicated IDs must never be resolved by guessing the current ticket.
  const candidates = messages
    .map((message, index) => (message.id === targetId ? index : -1))
    .filter(index => index >= 0);
  return candidates.length === 1 ? candidates[0] : -1;
};
export const messageListReducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const next = [...state];
    const prepended = [];
    action.payload.forEach(message => {
      const index = indexOf(next, message);
      if (index >= 0) next[index] = message;
      else {
        const incomingIndex = indexOf(prepended, message);
        if (incomingIndex >= 0) prepended[incomingIndex] = message;
        else prepended.push(message);
      }
    });
    return [...prepended, ...next];
  }
  if (action.type === "ADD_MESSAGE") {
    const message = action.payload;
    const next = upsertAtEnd(state, message);
    if (message.mediaType === "reactionMessage") {
      const index = reactionTargetIndex(next, message);
      if (index >= 0)
        next[index] = {
          ...next[index],
          replies: upsertAtEnd(next[index].replies || [], message)
        };
    }
    return next;
  }
  if (action.type === "UPDATE_MESSAGE") {
    return state.map(message =>
      messageIdentity(message) === messageIdentity(action.payload)
        ? action.payload
        : message
    );
  }
  if (action.type === "MERGE_MESSAGES") {
    const next = [...state];
    action.payload.forEach(message => {
      const index = indexOf(next, message);
      if (index >= 0) next[index] = message;
      else {
        const insertAt = next.findIndex(
          row => new Date(row.createdAt) > new Date(message.createdAt)
        );
        next.splice(insertAt < 0 ? next.length : insertAt, 0, message);
      }
    });
    return next;
  }
  if (action.type === "RESET_STICKY")
    return state.map(message => {
      const next = { ...message };
      delete next.bottomStick;
      return next;
    });
  if (action.type === "RESET") return [];
  return state;
};
