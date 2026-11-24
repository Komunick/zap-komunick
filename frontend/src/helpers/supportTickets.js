import { i18n } from "../translate/i18n";

// Zap Komunick: support tickets (RF-030). The backend checks the same limits
// again and reads the real type of each attachment from the file content.

/**
 * Translation with values written by people (names, file names, dates). React
 * already escapes what it renders; escaping here as well would show "&#x2F;"
 * in place of "/" on the screen.
 */
export const tr = (key, values) =>
  i18n.t(key, { ...values, interpolation: { escapeValue: false } });

export const SUPPORT_MAX_FILES = 5;
export const SUPPORT_MAX_TOTAL_MB = 15;
export const SUPPORT_MAX_TOTAL_BYTES = SUPPORT_MAX_TOTAL_MB * 1024 * 1024;
export const SUPPORT_TITLE_MAX = 140;
export const SUPPORT_LOCATION_MAX = 200;
export const SUPPORT_BODY_MAX = 4000;
export const SUPPORT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf";
export const SUPPORT_CATEGORIES = [
  "error",
  "wrong_data",
  "question",
  "access",
  "suggestion",
  "other"
];
export const SUPPORT_PRIORITIES = ["low", "medium", "high"];

const EXTENSIONS = /\.(png|jpe?g|gif|webp|mp4|webm|mov|pdf)$/i;

export const isSupportFile = file =>
  SUPPORT_ACCEPT.split(",").includes(file?.type) ||
  (!file?.type && EXTENSIONS.test(file?.name || ""));

export const totalBytes = files =>
  files.reduce((sum, file) => sum + (file.size || 0), 0);

/**
 * Adds the incoming files to the ones already chosen. Returns the new list
 * and, when something was left out, the reason: { code, name? }.
 */
export const addSupportFiles = (current, incoming) => {
  const files = [...current];
  let rejected = null;
  incoming.forEach(file => {
    if (rejected) return;
    if (!isSupportFile(file)) {
      rejected = { code: "type", name: file.name };
    } else if (files.length >= SUPPORT_MAX_FILES) {
      rejected = { code: "tooMany" };
    } else if (totalBytes(files) + file.size > SUPPORT_MAX_TOTAL_BYTES) {
      rejected = { code: "tooLarge" };
    } else {
      files.push(file);
    }
  });
  return { files, rejected };
};

export const megabytes = bytes =>
  (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");

export const isFinished = status => status === "done" || status === "cancelled";

/** Tickets still going and tickets finished, each keeping the server order. */
export const splitTickets = tickets => ({
  active: tickets.filter(ticket => !isFinished(ticket.status)),
  finished: tickets.filter(ticket => isFinished(ticket.status))
});

/** "Waiting for the requester" reads "Waiting for you" to the requester. */
export const statusKey = ticket =>
  ticket.status === "waiting" && ticket.mine ? "waitingYou" : ticket.status;

/**
 * Buttons each side gets, as in the Brazil TMS ticket desk. The requester can
 * only cancel a ticket nobody has taken yet; everything else is a message.
 */
export const supportActions = (ticket, isSuper) => {
  if (!isSuper)
    return ticket.mine && ticket.status === "open" ? ["cancel"] : [];
  switch (ticket.status) {
    case "open":
      return ["take", "request_info", "conclude", "cancel"];
    case "in_progress":
      return ["request_info", "conclude"];
    case "waiting":
      return ["resume", "conclude"];
    default:
      return ["reopen"];
  }
};

export const ACTIONS_WITH_TEXT = ["request_info", "conclude", "cancel"];

export const attachmentKind = mimeType => {
  if (mimeType === "application/pdf") return "pdf";
  if ((mimeType || "").startsWith("video/")) return "video";
  return "image";
};

export const attachmentUrl = (ticketId, attachmentId) =>
  `/support/tickets/${ticketId}/attachments/${encodeURIComponent(attachmentId)}`;
