import { useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";
import { SocketContext } from "../context/Socket/SocketContext";

// Zap Komunick: numbers of the support tickets (RF-030): what the user still
// has to read and, for support, the state of the queue. `onEvent` runs on
// every live event, after which the numbers are fetched again.
const useSupportSummary = onEvent => {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [summary, setSummary] = useState({ unread: 0, mineUnread: 0 });
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const userId = user?.id;
  const companyId = user?.companyId;

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/support/summary");
      setSummary(data);
    } catch {
      /* The badge is a convenience: a failed refresh keeps the last numbers. */
    }
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    refresh();
    const socket = socketManager?.GetSocket?.(companyId);
    if (!socket) return undefined;
    const onSupportTicket = data => {
      refresh();
      if (handler.current) handler.current(data);
    };
    socket.on("supportTicket", onSupportTicket);
    return () => socket.off("supportTicket", onSupportTicket);
  }, [userId, companyId, socketManager, refresh]);

  return { summary, refresh };
};

export default useSupportSummary;
