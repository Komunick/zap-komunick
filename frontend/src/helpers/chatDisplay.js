// Zap Komunick: how the internal chat names its conversations. A group has a
// title; a one-to-one conversation has none and shows the name of the other
// person, so it reads right for each side.

export function chatPeerId(chat, userId) {
  if (!chat?.isDirect) return null;
  const other = (chat.users || []).find(u => u.userId !== userId);
  return other ? other.userId : null;
}

export function chatDisplayName(chat, userId, usersById = {}) {
  if (!chat) return "";
  if (!chat.isDirect) return chat.title;
  const peerId = chatPeerId(chat, userId);
  const chatUser = (chat.users || []).find(u => u.userId === peerId);
  return usersById[peerId]?.name || chatUser?.user?.name || chat.title || "";
}

// the realtime events carry the chat without the "user" of each member:
// keep the names we already had
export function mergeChat(previous, incoming) {
  if (!previous) return incoming;
  const known = {};
  (previous.users || []).forEach(u => {
    if (u.user) known[u.userId] = u.user;
  });
  return {
    ...previous,
    ...incoming,
    users: (incoming.users || previous.users || []).map(u => ({
      ...u,
      user: u.user || known[u.userId]
    }))
  };
}
