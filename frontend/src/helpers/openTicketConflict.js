// Zap Komunick: text for ERR_OTHER_OPEN_TICKET with who has the open ticket
// (docs/PRD.md, RF-026).
import { format, parseISO } from "date-fns";
import { i18n } from "../translate/i18n";

// React already escapes what it renders; i18next escaping on top would show
// "20&#x2F;11" and "&amp;" in names.
const noEscape = { interpolation: { escapeValue: false } };

export function openTicketFromError(err) {
  const data = err?.response?.data;
  if (data?.error !== "ERR_OTHER_OPEN_TICKET") return null;
  return data?.details?.openTicket || null;
}

export function describeOpenTicketConflict(openTicket) {
  if (!openTicket) return i18n.t("backendErrors.ERR_OTHER_OPEN_TICKET");

  const parts = [];
  if (openTicket.status === "pending") {
    parts.push(i18n.t("openTicketConflict.pending"));
  } else if (openTicket.user?.name) {
    parts.push(
      i18n.t("openTicketConflict.withUser", {
        user: openTicket.user.name,
        ...noEscape
      })
    );
  } else {
    parts.push(i18n.t("openTicketConflict.withoutUser"));
  }
  if (openTicket.status === "paused") {
    parts.push(i18n.t("openTicketConflict.paused"));
  }
  if (openTicket.queue?.name) {
    parts.push(
      i18n.t("openTicketConflict.inQueue", {
        queue: openTicket.queue.name,
        ...noEscape
      })
    );
  }
  if (openTicket.whatsapp?.name) {
    parts.push(
      i18n.t(
        openTicket.whatsapp.connected
          ? "openTicketConflict.onChannel"
          : "openTicketConflict.onDisconnectedChannel",
        { channel: openTicket.whatsapp.name, ...noEscape }
      )
    );
  }
  let since = "";
  try {
    since = openTicket.updatedAt
      ? format(parseISO(openTicket.updatedAt), "dd/MM/yyyy HH:mm")
      : "";
  } catch {
    since = "";
  }

  return i18n.t("openTicketConflict.message", {
    id: openTicket.id,
    details: parts.join(", "),
    since: since || "-",
    ...noEscape
  });
}

export function askColleagueText(openTicket) {
  return i18n.t("openTicketConflict.askColleague", {
    user: openTicket?.user?.name || "",
    ...noEscape
  });
}
