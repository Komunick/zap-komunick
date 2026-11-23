// Zap Komunick: WhatsApp keeps one reaction per person and message. Changing
// the emoji sends a new reaction; removing it sends an empty one, which the
// backend stores with the body "reaction". Show only each sender's latest.
const REMOVED = new Set(["", "reaction"]);

const senderKey = reply =>
  reply.fromMe
    ? "me"
    : String(reply.contactId ?? reply.participant ?? reply.remoteJid ?? "");

export const visibleReactions = replies => {
  const latest = new Map();
  (replies || [])
    .filter(reply => reply?.mediaType === "reactionMessage")
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach(reply => latest.set(senderKey(reply), reply));
  return Array.from(latest.values()).filter(
    reply => !REMOVED.has((reply.body || "").trim())
  );
};
