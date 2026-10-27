import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  useMediaQuery
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import AssistantOutlinedIcon from "@material-ui/icons/AssistantOutlined";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { SocketContext } from "../../context/Socket/SocketContext";

export const ASSISTANT_TIMEOUT_MS = 30000;

const useStyles = makeStyles(theme => ({
  toolbar: {
    alignSelf: "stretch",
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(0, 2, 0.5)
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    margin: theme.spacing(2, 0)
  },
  notice: { marginTop: theme.spacing(1) },
  text: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    marginTop: theme.spacing(2)
  },
  references: { overflowWrap: "anywhere" },
  dialogActions: { flexWrap: "wrap" }
}));

const errorText = error => {
  const code = error?.response?.data?.error;
  const known = {
    ERR_ASSISTANT_DISABLED: "disabled",
    ERR_ASSISTANT_CONTEXT_CHANGED: "contextChanged",
    ERR_ASSISTANT_INVALID_OUTPUT: "invalidOutput",
    ERR_ASSISTANT_UNAVAILABLE: "unavailable",
    ERR_NO_PERMISSION: "noPermission",
    ERR_NO_TICKET_FOUND: "noPermission"
  };
  return i18n.t(`assistant.${known[code] || "requestError"}`);
};

// Zap Komunick: accept only this mock contract, in the currently selected ticket.
const validResult = (data, ticketId, kind) =>
  data?.simulated === true &&
  data?.requiresReview === true &&
  data?.mode === "mock" &&
  Number(data.ticketId) === Number(ticketId) &&
  data.kind === kind &&
  typeof data.text === "string" &&
  data.text.trim().length > 0 &&
  data.text.length <= 12000 &&
  Array.isArray(data.references) &&
  data.references.length <= 30 &&
  data.references.every(
    ref =>
      ref &&
      typeof ref.messageId === "string" &&
      ref.messageId.length > 0 &&
      ref.messageId.length <= 256 &&
      typeof ref.excerpt === "string" &&
      ref.excerpt.length <= 320
  ) &&
  data.context &&
  typeof data.context.partial === "boolean" &&
  Number.isInteger(data.context.messageCount) &&
  data.context.messageCount >= 0 &&
  data.context.messageCount <= 30 &&
  Number.isInteger(data.context.characterCount) &&
  data.context.characterCount >= 0 &&
  data.context.characterCount <= 12000 &&
  data.context.maxMessages === 30 &&
  data.context.maxCharacters === 12000 &&
  Array.isArray(data.warnings) &&
  data.warnings.every(warning => typeof warning === "string") &&
  data.warnings.includes("SIMULATED") &&
  data.warnings.includes("REVIEW_REQUIRED");

export default function TicketAssistant({
  ticketId,
  disabled = false,
  onUseDraft
}) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const socketManager = useContext(SocketContext);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState("");
  const request = useRef({
    sequence: 0,
    controller: null,
    timer: null,
    busy: false
  });
  const current = useRef({ ticketId, disabled, onUseDraft });
  current.current = { ticketId, disabled, onUseDraft };

  const invalidate = () => {
    request.current.sequence += 1;
    request.current.controller?.abort();
    clearTimeout(request.current.timer);
    request.current.timer = null;
    request.current.busy = false;
  };

  const run = async (operation, accept) => {
    invalidate();
    const sequence = request.current.sequence;
    const sourceTicketId = ticketId;
    const controller = new AbortController();
    request.current.controller = controller;
    request.current.busy = true;
    setBusy(true);
    setError("");
    request.current.timer = setTimeout(() => {
      if (request.current.sequence !== sequence) return;
      invalidate();
      setBusy(false);
      setError(i18n.t("assistant.timeout"));
    }, ASSISTANT_TIMEOUT_MS);
    const active = () =>
      request.current.sequence === sequence &&
      current.current.ticketId === sourceTicketId &&
      !controller.signal.aborted;
    try {
      const data = await operation(controller.signal);
      if (active()) accept(data);
    } catch (err) {
      if (active()) setError(errorText(err));
    } finally {
      if (active()) {
        clearTimeout(request.current.timer);
        request.current.timer = null;
        request.current.busy = false;
        setBusy(false);
      }
    }
  };

  const loadStatus = async () => {
    await run(
      async signal => {
        const response = await api.get(
          `/tickets/${ticketId}/assistant/status`,
          { signal }
        );
        return response.data;
      },
      data =>
        setStatus({
          enabled:
            data?.enabled === true &&
            data.mode === "mock" &&
            data.simulated === true,
          reason: data?.reason
        })
    );
  };

  useEffect(() => {
    loadStatus();
    return invalidate;
    // Each ticket owns its request lifetime; callbacks use current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    if (!disabled) return;
    invalidate();
    setOpen(false);
    setBusy(false);
    setResult(null);
    setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    if (!socketManager) return undefined;
    const socket = socketManager.GetSocket();
    const changed = setting => {
      if (setting?.key !== "aiAssistantEnabled") return;
      invalidate();
      setOpen(false);
      setResult(null);
      setDraft("");
      loadStatus();
    };
    socket.on("settings", changed);
    return () => {
      socket.off("settings", changed);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, ticketId]);

  const close = () => {
    invalidate();
    setOpen(false);
    setBusy(false);
    setResult(null);
    setDraft("");
    setError("");
  };

  const generate = async kind => {
    if (request.current.busy || current.current.disabled) return;
    setResult(null);
    setDraft("");
    await run(
      async signal => {
        const response = await api.post(
          `/tickets/${ticketId}/assistant`,
          { kind },
          { signal }
        );
        return response.data;
      },
      data => {
        if (current.current.disabled) return;
        if (!validResult(data, ticketId, kind)) {
          setError(i18n.t("assistant.invalidOutput"));
          return;
        }
        setResult(data);
        setDraft(kind === "reply" ? data.text : "");
      }
    );
  };

  const useDraft = async () => {
    if (
      request.current.busy ||
      !result ||
      result.kind !== "reply" ||
      !draft.trim() ||
      current.current.disabled
    )
      return;
    const text = draft.trim();
    const sourceTicketId = result.ticketId;
    await run(
      async signal => {
        const response = await api.get(
          `/tickets/${ticketId}/assistant/status`,
          { signal }
        );
        return response.data;
      },
      data => {
        if (
          data?.enabled !== true ||
          data.mode !== "mock" ||
          data.simulated !== true
        ) {
          setStatus({ enabled: false });
          setError(i18n.t("assistant.disabled"));
          return;
        }
        if (
          current.current.disabled ||
          current.current.onUseDraft(text, sourceTicketId) === false
        ) {
          setError(i18n.t("assistant.composerBlocked"));
          return;
        }
        close();
      }
    );
  };

  if (status && !status.enabled && !open) return null;

  return (
    <>
      <div className={classes.toolbar}>
        <Button
          size="small"
          startIcon={<AssistantOutlinedIcon />}
          disabled={disabled || busy}
          aria-label={i18n.t("assistant.open")}
          onClick={() => {
            setOpen(true);
            setResult(null);
            setDraft("");
            loadStatus();
          }}
        >
          {i18n.t("assistant.button")}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={close}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
        aria-labelledby="assistant-dialog-title"
      >
        <DialogTitle id="assistant-dialog-title">
          {i18n.t("assistant.title")}
        </DialogTitle>
        <DialogContent dividers>
          <Chip size="small" label={i18n.t("assistant.simulation")} />
          <Typography className={classes.notice}>
            {i18n.t("assistant.scope")}
          </Typography>
          <Alert severity="info" className={classes.notice}>
            {i18n.t("assistant.reviewRequired")}
          </Alert>
          <div className={classes.actions}>
            <Button
              variant="outlined"
              disabled={busy || disabled || !status?.enabled}
              onClick={() => generate("summary")}
            >
              {i18n.t("assistant.summary")}
            </Button>
            <Button
              variant="outlined"
              disabled={busy || disabled || !status?.enabled}
              onClick={() => generate("reply")}
            >
              {i18n.t("assistant.reply")}
            </Button>
          </div>
          {busy && (
            <div role="status" aria-live="polite">
              <CircularProgress
                size={20}
                aria-label={i18n.t("assistant.loading")}
              />{" "}
              {i18n.t("assistant.loading")}
            </div>
          )}
          {error && (
            <Alert severity="error" className={classes.notice}>
              {error}
            </Alert>
          )}
          {status && !status.enabled && (
            <Alert severity="warning" className={classes.notice}>
              {i18n.t("assistant.disabled")}
            </Alert>
          )}
          {result && (
            <>
              {result.context.partial && (
                <Alert severity="warning" className={classes.notice}>
                  {i18n.t("assistant.partial")}
                </Alert>
              )}
              {result.warnings?.includes("NO_MESSAGES") && (
                <Alert severity="warning" className={classes.notice}>
                  {i18n.t("assistant.noMessages")}
                </Alert>
              )}
              {result.warnings?.includes("INSUFFICIENT_INFORMATION") && (
                <Alert severity="warning" className={classes.notice}>
                  {i18n.t("assistant.insufficient")}
                </Alert>
              )}
              {result.kind === "reply" ? (
                <TextField
                  id="assistant-review-draft"
                  disabled={busy}
                  margin="normal"
                  label={i18n.t("assistant.draft")}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  multiline
                  minRows={4}
                  maxRows={10}
                  variant="outlined"
                  fullWidth
                  inputProps={{ maxLength: 12000 }}
                  helperText={i18n.t("assistant.appendHint")}
                />
              ) : (
                <Typography className={classes.text} tabIndex={0}>
                  {result.text}
                </Typography>
              )}
              <Typography variant="subtitle2" className={classes.notice}>
                {i18n.t("assistant.references")}
              </Typography>
              <List
                dense
                className={classes.references}
                aria-label={i18n.t("assistant.references")}
              >
                {result.references.map(ref => (
                  <ListItem key={ref.messageId}>
                    <ListItemText
                      primary={ref.messageId}
                      secondary={ref.excerpt}
                    />
                  </ListItem>
                ))}
                {!result.references.length && (
                  <ListItem>
                    <ListItemText primary={i18n.t("assistant.noReferences")} />
                  </ListItem>
                )}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button onClick={close}>{i18n.t("assistant.cancel")}</Button>
          {result?.kind === "reply" && (
            <Button
              color="primary"
              variant="contained"
              disabled={busy || disabled || !draft.trim()}
              onClick={useDraft}
            >
              {i18n.t("assistant.useDraft")}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
