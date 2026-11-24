import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import SendIcon from "@material-ui/icons/Send";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import {
  ACTIONS_WITH_TEXT,
  SUPPORT_ACCEPT,
  SUPPORT_BODY_MAX,
  isFinished,
  supportActions
} from "../../helpers/supportTickets";
import { PriorityBadge, StatusBadge } from "./Badges";
import DraftFiles from "./DraftFiles";
import MessageAttachments from "./MessageAttachments";
import { requestError } from "./NewTicketDialog";
import useAttachmentDraft from "./useAttachmentDraft";

// Zap Komunick: one support ticket with its live conversation (RF-030).
const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0
  },
  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3)
  },
  header: {
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75)
  },
  headerTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1)
  },
  title: { flex: 1, minWidth: 0, overflowWrap: "anywhere" },
  number: { fontFamily: "monospace" },
  badges: { display: "flex", flexWrap: "wrap", gap: theme.spacing(0.5) },
  context: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: theme.spacing(1.5),
    rowGap: 2,
    fontSize: 12,
    overflowWrap: "anywhere"
  },
  actions: { display: "flex", flexWrap: "wrap", gap: theme.spacing(1) },
  notice: { margin: theme.spacing(1, 2, 0) },
  messages: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    backgroundColor: theme.komunick?.subtle || theme.palette.background.default
  },
  bubble: {
    maxWidth: "min(80%, 560px)",
    padding: theme.spacing(1, 1.5),
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    alignSelf: "flex-start",
    overflowWrap: "anywhere"
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: theme.palette.action.selected
  },
  author: { fontWeight: 600, fontSize: 12 },
  body: { whiteSpace: "pre-wrap" },
  time: { display: "block", textAlign: "right", fontSize: 11 },
  event: {
    alignSelf: "center",
    textAlign: "center",
    maxWidth: "90%",
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 12,
    fontSize: 12,
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    overflowWrap: "anywhere"
  },
  eventBody: { whiteSpace: "pre-wrap", color: theme.palette.text.primary },
  composer: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 2, 1.5),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75)
  },
  dropping: { outline: `2px dashed ${theme.palette.primary.main}` },
  composerRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: theme.spacing(1)
  },
  hidden: { display: "none" }
}));

const fullDate = value => {
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "";
  }
};

const authorOf = message => {
  if (message.mine) return i18n.t("support.who.you");
  return message.fromSupport
    ? `${i18n.t("support.who.support")} · ${message.userName || ""}`
    : message.userName || "";
};

const eventText = message =>
  i18n.t(`support.events.${message.event}`, {
    name: message.mine
      ? i18n.t("support.who.you")
      : message.userName || i18n.t("support.who.support")
  });

const ActionDialog = ({ action, busy, error, onCancel, onConfirm }) => {
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);

  const confirm = event => {
    event.preventDefault();
    if (!text.trim()) {
      setMissing(true);
      return;
    }
    onConfirm(text.trim());
  };

  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <form onSubmit={confirm} noValidate>
        <DialogTitle>{i18n.t(`support.actions.${action}`)}</DialogTitle>
        <DialogContent>
          <TextField
            id="support-action-text"
            label={i18n.t(`support.actions.prompt.${action}`)}
            value={text}
            onChange={event => {
              setText(event.target.value);
              setMissing(false);
            }}
            inputProps={{ maxLength: SUPPORT_BODY_MAX }}
            variant="outlined"
            margin="dense"
            multiline
            minRows={3}
            maxRows={8}
            fullWidth
            autoFocus
            disabled={busy}
            error={missing}
            helperText={missing ? i18n.t("support.actions.textRequired") : ""}
          />
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={busy}>
            {i18n.t("support.actions.back")}
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={busy}
          >
            {i18n.t("support.actions.confirm")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const TicketDetail = ({ ticketId, isSuper, liveEvent, onBack, onChanged }) => {
  const classes = useStyles();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [dropping, setDropping] = useState(false);
  const draft = useAttachmentDraft();
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const scrollRef = useRef(null);
  const atBottom = useRef(true);
  const inputRef = useRef(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const apply = useCallback(data => {
    if (!mounted.current) return;
    setDetail(data);
    setLoadError("");
    // Opening the conversation is what reads it.
    if (data.ticket.unread)
      api
        .post(`/support/tickets/${data.ticket.id}/read`)
        .then(() => changed.current && changed.current())
        .catch(() => {});
  }, []);

  const load = useCallback(
    async quiet => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.get(`/support/tickets/${ticketId}`);
        apply(data);
      } catch (err) {
        if (mounted.current && !quiet) setLoadError(requestError(err));
      } finally {
        if (mounted.current && !quiet) setLoading(false);
      }
    },
    [ticketId, apply]
  );

  useEffect(() => {
    mounted.current = true;
    setDetail(null);
    setBody("");
    setError("");
    atBottom.current = true;
    load(false);
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Live: the server only says which ticket changed; the conversation is
  // fetched again with this user's own permissions.
  useEffect(() => {
    if (!liveEvent || liveEvent.ticketId !== ticketId) return;
    if (liveEvent.action === "read") return;
    load(true);
  }, [liveEvent, ticketId, load]);

  const messageCount = detail?.messages.length || 0;
  useEffect(() => {
    const box = scrollRef.current;
    // Follows new messages only when the reader was already at the end.
    if (box && atBottom.current) box.scrollTop = box.scrollHeight;
  }, [messageCount]);

  const run = async request => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await request();
      atBottom.current = true;
      apply(data);
      if (changed.current) changed.current();
      return true;
    } catch (err) {
      if (mounted.current) setError(requestError(err));
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const send = async () => {
    if (!body.trim() && !draft.files.length) return;
    const form = new FormData();
    form.append("body", body.trim());
    draft.files.forEach(file => form.append("files", file, file.name));
    const sent = await run(() =>
      api.post(`/support/tickets/${ticketId}/messages`, form)
    );
    if (sent && mounted.current) {
      setBody("");
      draft.clear();
    }
  };

  const act = async (action, text) => {
    const done = await run(() =>
      api.post(`/support/tickets/${ticketId}/actions`, { action, text })
    );
    if (done && mounted.current) setPendingAction(null);
  };

  if (loading)
    return (
      <div className={classes.center}>
        <CircularProgress />
      </div>
    );
  if (loadError || !detail)
    return (
      <div className={classes.center}>
        <Alert severity="error" role="alert">
          {loadError || i18n.t("support.loadError")}
        </Alert>
      </div>
    );

  const { ticket, messages } = detail;
  const actions = supportActions(ticket, isSuper);
  const finished = isFinished(ticket.status);
  const context = isSuper
    ? [
        [i18n.t("support.detail.company"), ticket.companyName],
        [
          i18n.t("support.detail.requester"),
          [ticket.userName, ticket.userEmail].filter(Boolean).join(" · ")
        ],
        [i18n.t("support.detail.profile"), ticket.userProfile],
        [i18n.t("support.detail.location"), ticket.location],
        [i18n.t("support.detail.address"), ticket.appUrl],
        [i18n.t("support.detail.screen"), ticket.screen],
        [i18n.t("support.detail.browser"), ticket.userAgent]
      ].filter(([, value]) => value)
    : [];
  let notice = "";
  if (ticket.status === "done") notice = i18n.t("support.detail.finished");
  else if (ticket.status === "cancelled")
    notice = i18n.t("support.detail.cancelled");
  else if (ticket.status === "waiting" && ticket.mine)
    notice = i18n.t("support.detail.waitingYou");

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.headerTop}>
          {onBack && (
            <IconButton
              size="small"
              onClick={onBack}
              aria-label={i18n.t("support.detail.back")}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <div className={classes.title}>
            <Typography
              className={classes.number}
              variant="caption"
              color="textSecondary"
            >
              {ticket.number}
            </Typography>
            <Typography variant="subtitle1" component="h2">
              {ticket.title}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {i18n.t("support.detail.openedBy", {
                name: ticket.mine
                  ? i18n.t("support.who.you")
                  : ticket.userName || "-",
                date: fullDate(ticket.createdAt)
              })}
              {" · "}
              {i18n.t(`support.category.${ticket.category}`)}
              {" · "}
              {i18n.t("support.detail.assignee")}:{" "}
              {ticket.assignedUserName || i18n.t("support.detail.noAssignee")}
            </Typography>
          </div>
        </div>
        <div className={classes.badges}>
          <StatusBadge ticket={ticket} />
          <PriorityBadge priority={ticket.priority} always />
        </div>
        {context.length > 0 && (
          <div
            className={classes.context}
            aria-label={i18n.t("support.detail.context")}
          >
            {context.map(([label, value]) => (
              <React.Fragment key={label}>
                <Typography variant="caption" color="textSecondary">
                  {label}
                </Typography>
                <Typography variant="caption">{value}</Typography>
              </React.Fragment>
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <div className={classes.actions}>
            {actions.map(action => (
              <Button
                key={action}
                size="small"
                variant={
                  action === "take" || action === "conclude"
                    ? "contained"
                    : "outlined"
                }
                color={action === "cancel" ? "default" : "primary"}
                disabled={busy}
                onClick={() =>
                  ACTIONS_WITH_TEXT.includes(action)
                    ? setPendingAction(action)
                    : act(action)
                }
              >
                {i18n.t(`support.actions.${action}`)}
              </Button>
            ))}
          </div>
        )}
      </div>
      {notice && (
        <Alert
          className={classes.notice}
          severity={finished ? "info" : "warning"}
          role="status"
        >
          {notice}
        </Alert>
      )}
      <div
        className={classes.messages}
        ref={scrollRef}
        role="log"
        aria-live="polite"
        onScroll={event => {
          const box = event.currentTarget;
          atBottom.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        }}
      >
        {!messages.length && (
          <Typography color="textSecondary" align="center">
            {i18n.t("support.empty.conversation")}
          </Typography>
        )}
        {messages.map(message =>
          message.kind === "event" ? (
            <div key={message.id} className={classes.event}>
              {eventText(message)} · {fullDate(message.createdAt)}
              {message.body && (
                <div className={classes.eventBody}>{message.body}</div>
              )}
            </div>
          ) : (
            <div
              key={message.id}
              className={`${classes.bubble} ${message.mine ? classes.mine : ""}`}
            >
              <Typography className={classes.author} color="textSecondary">
                {authorOf(message)}
              </Typography>
              {message.body && (
                <Typography variant="body2" className={classes.body}>
                  {message.body}
                </Typography>
              )}
              <MessageAttachments
                ticketId={ticket.id}
                attachments={message.attachments}
              />
              <Typography className={classes.time} color="textSecondary">
                {fullDate(message.createdAt)}
              </Typography>
            </div>
          )
        )}
      </div>
      <div
        className={`${classes.composer} ${dropping ? classes.dropping : ""}`}
        data-testid="support-composer"
        onDragOver={event => {
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={event => {
          event.preventDefault();
          setDropping(false);
          draft.add(Array.from(event.dataTransfer?.files || []));
        }}
      >
        <DraftFiles
          files={draft.files}
          onRemove={draft.remove}
          disabled={busy}
        />
        {(error || draft.error) && !pendingAction && (
          <Alert severity="error" role="alert">
            {error || draft.error}
          </Alert>
        )}
        <div className={classes.composerRow}>
          <IconButton
            size="small"
            onClick={() => inputRef.current?.click()}
            aria-label={i18n.t("support.attachments.add")}
            disabled={busy}
          >
            <AttachFileIcon />
          </IconButton>
          <input
            ref={inputRef}
            className={classes.hidden}
            type="file"
            multiple
            accept={SUPPORT_ACCEPT}
            data-testid="support-composer-files"
            onChange={event => {
              draft.add(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <TextField
            id="support-message-body"
            value={body}
            onChange={event => setBody(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            onPaste={event => {
              const pasted = Array.from(event.clipboardData?.files || []);
              if (!pasted.length) return;
              event.preventDefault();
              draft.add(pasted);
            }}
            placeholder={
              finished
                ? i18n.t("support.composer.reopen")
                : i18n.t("support.composer.placeholder")
            }
            inputProps={{
              maxLength: SUPPORT_BODY_MAX,
              "aria-label": finished
                ? i18n.t("support.composer.reopen")
                : i18n.t("support.composer.placeholder")
            }}
            helperText={i18n.t("support.composer.hint")}
            variant="outlined"
            margin="dense"
            multiline
            maxRows={6}
            fullWidth
            disabled={busy}
          />
          <IconButton
            color="primary"
            onClick={send}
            aria-label={i18n.t("support.composer.send")}
            disabled={busy || (!body.trim() && !draft.files.length)}
          >
            {busy ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </div>
      </div>
      {pendingAction && (
        <ActionDialog
          action={pendingAction}
          busy={busy}
          error={error}
          onCancel={() => {
            setPendingAction(null);
            setError("");
          }}
          onConfirm={text => act(pendingAction, text)}
        />
      )}
    </div>
  );
};

export default TicketDetail;
