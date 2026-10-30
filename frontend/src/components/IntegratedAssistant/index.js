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
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import {
  PROVIDERS,
  validClients,
  validResult,
  validReview,
  validStatus
} from "./contract";

export const INTEGRATED_TIMEOUT_MS = 30000;
const useStyles = makeStyles(theme => ({
  toolbar: {
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
  section: {
    marginTop: theme.spacing(3),
    minWidth: 0,
    overflowWrap: "anywhere"
  },
  fields: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginTop: theme.spacing(1)
  },
  client: { flex: "1 1 220px", minWidth: 0 },
  page: { flex: "0 1 100px" },
  text: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    marginTop: theme.spacing(2)
  },
  footer: { flexWrap: "wrap" }
}));
const t = (key, options) => i18n.t(`integratedAssistant.${key}`, options);
const failOutput = () => {
  const error = new Error("ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT");
  error.code = error.message;
  throw error;
};
const errorText = failure => {
  const code = failure?.response?.data?.error || failure?.code;
  if (code === "ERR_NO_PERMISSION" || code === "ERR_NO_TICKET_FOUND")
    return t("permission");
  if (
    typeof code === "string" &&
    /_(CONTEXT_CHANGED|CLIENT_NOT_LINKED|CLIENT_NOT_FOUND)$/.test(code)
  )
    return t("contextChanged");
  if (typeof code === "string" && /_DISABLED$/.test(code)) return t("disabled");
  if (code === "ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT")
    return t("invalidOutput");
  return t("requestError");
};
const sourceErrorText = code => {
  const suffix = {
    FUNCTIONAL_ERROR: "functionalError",
    CLIENT_NOT_FOUND: "sourceNotFound",
    INVALID_OUTPUT: "invalidOutput",
    UPSTREAM_UNAUTHORIZED: "upstreamUnauthorized",
    RATE_LIMITED: "rateLimited",
    TIMEOUT: "timeout",
    DISABLED: "sourceDisabled",
    UNAVAILABLE: "sourceUnavailable"
  };
  const name = Object.keys(suffix).find(key => code?.endsWith(`_${key}`));
  return t(suffix[name] || "sourceUnavailable");
};
const emptySelections = () => ({ acessorias: "", sci: "" });
const firstPages = () => ({ acessorias: "1", sci: "1" });

function SourceResult({ provider, item, classes }) {
  if (item.state === "notSelected")
    return <Typography>{t("notSelected")}</Typography>;
  if (item.state === "error")
    return <Alert severity="warning">{sourceErrorText(item.errorCode)}</Alert>;
  const data = item.data;
  const items = provider === "sci" ? data.publications : data.pendingItems;
  const date = value =>
    new Date(value).toLocaleString(
      (i18n.language || "pt-BR").replace(/_/g, "-")
    );
  return (
    <>
      <Typography>{data.client.name}</Typography>
      <Typography variant="body2">{data.client.documentLabel}</Typography>
      <List dense aria-label={t(`${provider}Items`)}>
        {items.map(row => (
          <ListItem key={row.id} disableGutters>
            <ListItemText
              primary={row.title}
              secondary={
                provider === "sci"
                  ? `${row.categoryLabel} · ${row.periodLabel} · ${date(row.publishedAt)}`
                  : `${row.periodLabel} · ${row.dueLabel}`
              }
            />
          </ListItem>
        ))}
      </List>
      {!items.length && <Typography>{t("emptySource")}</Typography>}
      <Typography variant="body2">
        {t("pageResult", {
          page: data.pagination.page,
          count: items.length,
          total: data.pagination.total
        })}
      </Typography>
      <Typography variant="body2" className={classes.notice}>
        {data.source.label}
      </Typography>
      <Typography variant="body2">
        {t("updatedAt", {
          date: date(data.source.updatedAt),
          interpolation: { escapeValue: false }
        })}
      </Typography>
      <Typography variant="body2">
        {t("fetchedAt", {
          date: date(data.source.fetchedAt),
          interpolation: { escapeValue: false }
        })}
      </Typography>
      {data.source.stale && (
        <Alert severity="warning" className={classes.notice}>
          {t("stale")}
        </Alert>
      )}
    </>
  );
}

function IntegratedAssistantContent({
  ticketId,
  contactId,
  companyId,
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
  const [clients, setClients] = useState(null);
  const [selected, setSelected] = useState(emptySelections);
  const [pages, setPages] = useState(firstPages);
  const [result, setResult] = useState(null);
  const [resultSelections, setResultSelections] = useState(null);
  const [draft, setDraft] = useState("");
  const request = useRef({
    sequence: 0,
    controller: null,
    timer: null,
    busy: false
  });
  const current = useRef(null);
  current.current = { ticketId, disabled, onUseDraft, open };
  const base = `/tickets/${ticketId}/integrated-assistant`;
  const invalidate = () => {
    request.current.sequence += 1;
    request.current.controller?.abort();
    clearTimeout(request.current.timer);
    request.current.timer = null;
    request.current.busy = false;
  };
  const clearResult = () => {
    setResult(null);
    setResultSelections(null);
    setDraft("");
  };
  const reset = () => {
    clearResult();
    setSelected(emptySelections());
    setPages(firstPages());
    setClients(null);
  };
  const run = async (operation, accept) => {
    invalidate();
    const sequence = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    request.current.busy = true;
    setBusy(true);
    setError("");
    const active = () =>
      request.current.sequence === sequence &&
      current.current.ticketId === ticketId &&
      !controller.signal.aborted;
    request.current.timer = setTimeout(() => {
      if (!active()) return;
      invalidate();
      setBusy(false);
      clearResult();
      setError(t("timeout"));
    }, INTEGRATED_TIMEOUT_MS);
    try {
      const data = await operation(controller.signal);
      if (active()) accept(data);
    } catch (failure) {
      if (active()) {
        clearResult();
        setError(errorText(failure));
        const code = failure?.response?.data?.error || failure?.code;
        if (
          typeof code === "string" &&
          /_(CONTEXT_CHANGED|CLIENT_NOT_LINKED|CLIENT_NOT_FOUND|DISABLED)$/.test(
            code
          )
        ) {
          setSelected(emptySelections());
          setClients(null);
        }
        if (["ERR_NO_PERMISSION", "ERR_NO_TICKET_FOUND"].includes(code)) {
          reset();
          setStatus(null);
        }
      }
    } finally {
      if (active()) {
        clearTimeout(request.current.timer);
        request.current.timer = null;
        request.current.busy = false;
        setBusy(false);
      }
    }
  };
  const getStatus = async signal => {
    const { data } = await api.get(`${base}/status`, { signal });
    if (!validStatus(data)) failOutput();
    return data;
  };
  const loadStatus = () => run(getStatus, setStatus);
  const loadClients = () => {
    reset();
    return run(
      async signal => {
        const nextStatus = await getStatus(signal);
        if (!nextStatus.enabled) return { nextStatus, data: null };
        const response = await api.get(`${base}/clients`, { signal });
        if (!validClients(response.data)) failOutput();
        return { nextStatus, data: response.data };
      },
      next => {
        setStatus(next.nextStatus);
        setClients(next.data);
      }
    );
  };
  useEffect(() => {
    if (disabled) {
      invalidate();
      setBusy(false);
      setOpen(false);
      reset();
      setError("");
    } else loadStatus();
    return invalidate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, disabled]);
  useEffect(() => {
    if (!socketManager) return undefined;
    const socket = socketManager.GetSocket();
    const settingsChanged = setting => {
      if (
        ![
          "integratedAssistantEnabled",
          "aiAssistantEnabled",
          "acessoriasEnabled",
          "sciEnabled"
        ].includes(setting?.key)
      )
        return;
      invalidate();
      setBusy(false);
      setOpen(false);
      reset();
      setError("");
      if (!current.current.disabled) loadStatus();
    };
    const linksChanged = change => {
      if (Number(change?.contactId) !== Number(contactId)) return;
      invalidate();
      setBusy(false);
      reset();
      setError("");
      if (current.current.open) loadClients();
    };
    socket.on("settings", settingsChanged);
    PROVIDERS.forEach(provider =>
      socket.on(`company-${companyId}-${provider}-links`, linksChanged)
    );
    return () => {
      socket.off("settings", settingsChanged);
      PROVIDERS.forEach(provider =>
        socket.off(`company-${companyId}-${provider}-links`, linksChanged)
      );
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, ticketId, contactId, companyId]);
  const close = () => {
    invalidate();
    setBusy(false);
    setOpen(false);
    reset();
    setError("");
  };
  const changeSelection = (provider, value) => {
    invalidate();
    setBusy(false);
    clearResult();
    setError("");
    setSelected(previous => ({ ...previous, [provider]: value }));
    setPages(previous => ({ ...previous, [provider]: "1" }));
  };
  const changePage = (provider, value) => {
    invalidate();
    setBusy(false);
    clearResult();
    setError("");
    setPages(previous => ({ ...previous, [provider]: value }));
  };
  const pageValid = provider =>
    /^[1-9]\d*$/.test(pages[provider]) && Number(pages[provider]) <= 100;
  const selectionValid = PROVIDERS.every(
    provider =>
      !selected[provider] ||
      (pageValid(provider) &&
        clients?.providers[provider]?.state === "ready" &&
        clients.providers[provider].clients.some(
          client => client.externalClientId === selected[provider]
        ))
  );
  const hasSelection = PROVIDERS.some(provider => !!selected[provider]);
  const selections = () =>
    Object.fromEntries(
      PROVIDERS.map(provider => [
        provider,
        selected[provider]
          ? {
              externalClientId: selected[provider],
              page: Number(pages[provider])
            }
          : null
      ])
    );
  const generate = kind => {
    if (
      request.current.busy ||
      current.current.disabled ||
      !status?.enabled ||
      !selectionValid ||
      !hasSelection
    )
      return;
    clearResult();
    const sources = selections();
    run(
      async signal => {
        const { data } = await api.post(base, { kind, sources }, { signal });
        if (!validResult(data, ticketId, contactId, kind, sources))
          failOutput();
        return data;
      },
      data => {
        if (current.current.disabled) return;
        setResult(data);
        setResultSelections(sources);
        setDraft(kind === "reply" ? data.text : "");
      }
    );
  };
  const useDraft = () => {
    if (
      request.current.busy ||
      current.current.disabled ||
      result?.kind !== "reply" ||
      !resultSelections ||
      !draft.trim()
    )
      return;
    const text = draft.trim();
    const sourceTicketId = result.ticketId;
    run(
      async signal => {
        const { data } = await api.post(
          `${base}/review`,
          {
            kind: "reply",
            sources: resultSelections,
            contextVersion: result.contextVersion
          },
          { signal }
        );
        if (!validReview(data)) failOutput();
        return data;
      },
      () => {
        if (
          current.current.disabled ||
          current.current.onUseDraft(text, sourceTicketId) === false
        ) {
          setError(t("composerBlocked"));
          return;
        }
        close();
      }
    );
  };
  if (!status?.enabled && !open) return null;
  return (
    <>
      <div className={classes.toolbar}>
        <Button
          size="small"
          startIcon={<AssistantOutlinedIcon />}
          disabled={disabled || busy}
          aria-label={t("open")}
          onClick={() => {
            setOpen(true);
            loadClients();
          }}
        >
          {t("button")}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={close}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="md"
        aria-labelledby="integrated-assistant-dialog-title"
      >
        <DialogTitle id="integrated-assistant-dialog-title">
          {t("title")}
        </DialogTitle>
        <DialogContent dividers>
          <Chip size="small" label={t("simulation")} />
          <Alert severity="info" className={classes.notice}>
            {t("scope")}
          </Alert>
          <Typography className={classes.notice}>
            {t("reviewRequired")}
          </Typography>
          {!status?.enabled && (
            <Alert severity="warning" className={classes.notice}>
              {t("disabled")}
            </Alert>
          )}
          {PROVIDERS.map(provider => {
            const state = clients?.providers[provider];
            return (
              <section
                key={provider}
                className={classes.section}
                aria-label={t(provider)}
              >
                <Typography variant="h6">{t(provider)}</Typography>
                <div className={classes.fields}>
                  <TextField
                    id={`integrated-${provider}-client`}
                    className={classes.client}
                    label={t(`${provider}Client`)}
                    select
                    SelectProps={{ native: true }}
                    value={selected[provider]}
                    onChange={event =>
                      changeSelection(provider, event.target.value)
                    }
                    variant="outlined"
                    disabled={
                      busy ||
                      disabled ||
                      state?.state !== "ready" ||
                      !state.clients.length
                    }
                  >
                    <option value="">{t("notSelected")}</option>
                    {(state?.clients || []).map(client => (
                      <option
                        key={client.externalClientId}
                        value={client.externalClientId}
                      >
                        {client.name} — {client.documentLabel}
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    id={`integrated-${provider}-page`}
                    className={classes.page}
                    label={t(`${provider}Page`)}
                    type="number"
                    variant="outlined"
                    value={pages[provider]}
                    inputProps={{ min: 1, max: 100, step: 1 }}
                    disabled={busy || disabled || !selected[provider]}
                    onChange={event => changePage(provider, event.target.value)}
                    error={!!selected[provider] && !pageValid(provider)}
                    helperText={
                      selected[provider] && !pageValid(provider)
                        ? t("invalidPage")
                        : t("pageHint")
                    }
                  />
                </div>
                {state?.state === "ready" && !state.clients.length && (
                  <Typography className={classes.notice}>
                    {t("noLinkedClients")}
                  </Typography>
                )}
                {state?.state === "disabled" && (
                  <Alert severity="warning" className={classes.notice}>
                    {t("sourceDisabled")}
                  </Alert>
                )}
                {state?.state === "error" && (
                  <Alert severity="warning" className={classes.notice}>
                    {sourceErrorText(state.errorCode)}
                  </Alert>
                )}
              </section>
            );
          })}
          <Typography variant="body2" className={classes.notice}>
            {t("selectionHint")}
          </Typography>
          <div className={classes.actions}>
            <Button
              variant="outlined"
              disabled={busy || disabled || !status?.enabled}
              onClick={loadClients}
            >
              {t("refreshClients")}
            </Button>
            {["summary", "reply"].map(kind => (
              <Button
                key={kind}
                variant="outlined"
                disabled={
                  busy ||
                  disabled ||
                  !status?.enabled ||
                  !hasSelection ||
                  !selectionValid
                }
                onClick={() => generate(kind)}
              >
                {t(kind)}
              </Button>
            ))}
          </div>
          {busy && (
            <div role="status" aria-live="polite">
              <CircularProgress size={20} aria-label={t("loading")} />{" "}
              {t("loading")}
            </div>
          )}
          {error && (
            <Alert severity="error" className={classes.notice}>
              {error}
            </Alert>
          )}
          {result && (
            <section className={classes.section} aria-label={t("result")}>
              {result.warnings
                .filter(
                  warning => !["SIMULATED", "REVIEW_REQUIRED"].includes(warning)
                )
                .map(warning => (
                  <Alert
                    key={warning}
                    severity="warning"
                    className={classes.notice}
                  >
                    {t(`warnings.${warning}`)}
                  </Alert>
                ))}
              {result.kind === "reply" ? (
                <TextField
                  id="integrated-review-draft"
                  label={t("draft")}
                  value={draft}
                  disabled={busy || disabled}
                  onChange={event => setDraft(event.target.value)}
                  multiline
                  minRows={4}
                  maxRows={10}
                  variant="outlined"
                  fullWidth
                  inputProps={{ maxLength: 12000 }}
                  helperText={t("appendHint")}
                />
              ) : (
                <Typography className={classes.text} tabIndex={0}>
                  {result.text}
                </Typography>
              )}
              <Typography variant="subtitle2" className={classes.notice}>
                {t("references")}
              </Typography>
              <List dense aria-label={t("references")}>
                {result.references.map(ref => (
                  <ListItem key={ref.messageId} disableGutters>
                    <ListItemText
                      primary={ref.messageId}
                      secondary={ref.excerpt}
                    />
                  </ListItem>
                ))}
                {!result.references.length && (
                  <ListItem disableGutters>
                    <ListItemText primary={t("noReferences")} />
                  </ListItem>
                )}
              </List>
              {PROVIDERS.map(provider => (
                <section
                  key={provider}
                  className={classes.section}
                  aria-label={t(`${provider}Result`)}
                >
                  <Typography variant="h6">{t(provider)}</Typography>
                  <SourceResult
                    provider={provider}
                    item={result.sources[provider]}
                    classes={classes}
                  />
                </section>
              ))}
            </section>
          )}
        </DialogContent>
        <DialogActions className={classes.footer}>
          <Button onClick={close}>{t("cancel")}</Button>
          {result?.kind === "reply" && (
            <Button
              color="primary"
              variant="contained"
              disabled={busy || disabled || !draft.trim()}
              onClick={useDraft}
            >
              {t("useDraft")}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function IntegratedAssistant(props) {
  const auth = useContext(AuthContext);
  const viewer = auth?.user;
  if (
    !Number.isSafeInteger(Number(props.ticketId)) ||
    Number(props.ticketId) <= 0 ||
    !Number.isSafeInteger(Number(props.contactId)) ||
    Number(props.contactId) <= 0
  )
    return null;
  const viewerKey = JSON.stringify([
    viewer?.id,
    viewer?.companyId,
    viewer?.profile,
    (viewer?.queues || []).map(queue => queue.id).sort((a, b) => a - b)
  ]);
  return (
    <IntegratedAssistantContent
      key={`${props.ticketId}:${props.contactId}:${props.companyId}:${props.contextKey || ""}:${viewerKey}`}
      {...props}
    />
  );
}
