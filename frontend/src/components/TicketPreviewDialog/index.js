import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  makeStyles
} from "@material-ui/core";
import { format, isValid, parseISO } from "date-fns";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { formatWhatsappContactName } from "../../helpers/formatWhatsappDisplay";

const useStyles = makeStyles(theme => ({
  content: {
    backgroundColor: theme.komunick.chatBackground
  },
  conversation: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    maxHeight: "min(60vh, 560px)",
    overflowY: "auto",
    padding: theme.spacing(0.5, 0.5, 1)
  },
  message: {
    maxWidth: "85%",
    borderRadius: theme.shape.borderRadius,
    overflowWrap: "anywhere",
    padding: theme.spacing(1, 1.5),
    whiteSpace: "pre-wrap",
    boxShadow: theme.komunick.shadow
  },
  received: {
    alignSelf: "flex-start",
    backgroundColor: theme.komunick.bubbleTheirs
  },
  sent: {
    alignSelf: "flex-end",
    backgroundColor: theme.komunick.bubbleMine,
    border: `1px solid ${theme.komunick.bubbleMineBorder}`
  },
  messageText: {
    marginTop: theme.spacing(0.5)
  },
  time: {
    display: "block",
    marginTop: theme.spacing(0.5),
    textAlign: "right"
  },
  notice: {
    marginBottom: theme.spacing(1)
  }
}));

const time = value => {
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  return isValid(date) ? format(date, "dd/MM HH:mm") : "";
};

// Zap Komunick: preview of the whole pending conversation. Reading it never
// accepts the ticket; only "Aceitar e abrir" does (onAccept).
export default function TicketPreviewDialog({
  ticket,
  onClose,
  onAccept,
  accepting
}) {
  const classes = useStyles();
  const [conversation, setConversation] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const listRef = useRef(null);
  const titleId = `ticket-preview-title-${ticket.id}`;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(`/messages/${ticket.id}/preview`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        // Older backends answer only with the last received message.
        const messages = Array.isArray(data?.messages)
          ? data.messages
          : data?.preview
            ? [{ id: "preview", fromMe: false, ...data.preview }]
            : [];
        setConversation({ messages, truncated: !!data?.truncated });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [ticket.id]);

  // Open at the newest message; the agent scrolls up for the rest.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [conversation]);

  const waiting = conversation === undefined && !failed;
  const messages = conversation?.messages || [];

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      scroll="paper"
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{i18n.t("ticketPreview.title")}</DialogTitle>
      <DialogContent dividers className={classes.content}>
        <Typography variant="subtitle2" gutterBottom>
          {formatWhatsappContactName(ticket.contact, ticket)}
        </Typography>
        {failed ? (
          <Typography role="alert" color="error">
            {i18n.t("ticketPreview.unavailable")}
          </Typography>
        ) : waiting ? (
          <Typography role="status" color="textSecondary">
            {i18n.t("ticketPreview.loading")}
          </Typography>
        ) : messages.length ? (
          <>
            {conversation.truncated && (
              <Typography
                variant="caption"
                color="textSecondary"
                component="p"
                className={classes.notice}
              >
                {i18n.t("ticketPreview.truncated")}
              </Typography>
            )}
            <div
              ref={listRef}
              className={classes.conversation}
              role="log"
              aria-label={i18n.t("ticketPreview.conversation")}
              tabIndex={0}
            >
              {messages.map((message, index) => {
                const label = message.kind !== "text" || !message.text;
                return (
                  <div
                    key={`${message.id}-${index}`}
                    className={`${classes.message} ${
                      message.fromMe ? classes.sent : classes.received
                    }`}
                  >
                    {label && (
                      <Typography variant="body2" color="textSecondary">
                        {i18n.t(`ticketPreview.kinds.${message.kind}`)}
                      </Typography>
                    )}
                    {message.text && (
                      <Typography
                        variant="body2"
                        className={label ? classes.messageText : undefined}
                      >
                        {message.text}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      className={classes.time}
                    >
                      {message.fromMe
                        ? `${i18n.t("ticketPreview.sent")} · `
                        : ""}
                      {time(message.createdAt)}
                    </Typography>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("ticketPreview.empty")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("common.close")}</Button>
        {onAccept && (
          <Button
            color="primary"
            variant="contained"
            disabled={accepting || waiting || failed}
            onClick={onAccept}
          >
            {i18n.t("ticketPreview.accept")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
