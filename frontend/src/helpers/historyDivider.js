// Zap Komunick: the title of the line that separates the tickets of a client
// in the conversation (docs/PRD.md, RF-017 and RF-027).
//
// A ticket that is not the open one is not always an old one: the client may
// be, right now, in another ticket (transferred to another sector, with
// another attendant). Calling that one "anterior" reads as a closed matter.
export const historyDividerKey = (messageTicketId, currentTicketId, info) => {
  if (messageTicketId === currentTicketId) return "history.currentTicket";
  if (info?.status && info.status !== "closed") return "history.ongoingTicket";
  return "history.previousTicket";
};

// A message of another ticket of the client, shown in the history, whose
// ticket the viewer may not open (it is in another sector now). It can be read
// and quoted in a reply sent through the open ticket; reacting, editing,
// deleting, forwarding and the edit history are decided by the ticket of the
// message and the server refuses them. Without the facts of the ticket nothing
// is hidden: the server stays the one that decides.
export const isReplyOnlyHistoryMessage = (message, currentTicketId, info) =>
  !!message?.ticketId &&
  message.ticketId !== currentTicketId &&
  info?.canOpen === false;
