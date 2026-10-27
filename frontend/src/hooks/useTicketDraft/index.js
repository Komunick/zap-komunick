import { useEffect, useRef, useState } from "react";

// Zap Komunick: bind each stored draft to its owner, including during a route
// transition. Assistant output reaches this existing storage only after accept.
export default function useTicketDraft(ticketId) {
  const activeTicket = useRef(ticketId);
  activeTicket.current = ticketId;
  const read = id => sessionStorage.getItem(`messageDraft-${id}`) || "";
  const [draft, setDraft] = useState(() => ({
    ticketId,
    text: read(ticketId)
  }));

  useEffect(() => {
    const key = `messageDraft-${draft.ticketId}`;
    if (draft.text) sessionStorage.setItem(key, draft.text);
    else sessionStorage.removeItem(key);
  }, [draft]);

  useEffect(() => {
    setDraft(previous =>
      previous.ticketId === ticketId
        ? previous
        : { ticketId, text: read(ticketId) }
    );
  }, [ticketId]);

  const setInputMessage = value => {
    if (activeTicket.current !== ticketId) return;
    setDraft(previous => {
      if (activeTicket.current !== ticketId) return previous;
      const text =
        previous.ticketId === ticketId ? previous.text : read(ticketId);
      return {
        ticketId,
        text: typeof value === "function" ? value(text) : value
      };
    });
  };
  return [draft.ticketId === ticketId ? draft.text : "", setInputMessage];
}
