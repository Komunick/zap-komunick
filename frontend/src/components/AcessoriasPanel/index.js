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
import BusinessOutlinedIcon from "@material-ui/icons/BusinessOutlined";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { SocketContext } from "../../context/Socket/SocketContext";

export const ACESSORIAS_TIMEOUT_MS = 30000;
const useStyles = makeStyles(theme => ({
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(0.5, 2)
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    margin: theme.spacing(2, 0)
  },
  notice: { marginTop: theme.spacing(1) },
  section: { marginTop: theme.spacing(2), overflowWrap: "anywhere" },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center"
  },
  grow: { flex: "1 1 180px", overflowWrap: "anywhere" },
  footer: { flexWrap: "wrap" }
}));

const validId = value =>
  typeof value === "string" && value.length > 0 && value.length <= 100;
const validClient = client =>
  client &&
  validId(client.externalClientId) &&
  typeof client.name === "string" &&
  client.name.length <= 200 &&
  typeof client.documentLabel === "string" &&
  client.documentLabel.length <= 200;
const validSource = source =>
  source?.provider === "acessorias" &&
  typeof source.label === "string" &&
  source.label.length <= 200 &&
  typeof source.fetchedAt === "string" &&
  source.fetchedAt.length <= 50 &&
  typeof source.updatedAt === "string" &&
  source.updatedAt.length <= 50 &&
  Number.isFinite(Date.parse(source.fetchedAt)) &&
  Number.isFinite(Date.parse(source.updatedAt)) &&
  typeof source.stale === "boolean";
const mockEnvelope = data => data?.mode === "mock" && data.simulated === true;
const validList = data =>
  mockEnvelope(data) &&
  Array.isArray(data.clients) &&
  data.clients.length <= 100 &&
  data.clients.every(validClient) &&
  new Set(data.clients.map(client => client.externalClientId)).size ===
    data.clients.length &&
  validSource(data.source);
const validStatus = data =>
  data &&
  typeof data.enabled === "boolean" &&
  ["disabled", "mock"].includes(data.mode) &&
  data.simulated === true &&
  (data.enabled
    ? data.mode === "mock" && data.reason === null
    : (data.mode === "disabled" && data.reason === "SERVER_DISABLED") ||
      (data.mode === "mock" && data.reason === "COMPANY_DISABLED")) &&
  typeof data.canManageLinks === "boolean" &&
  data.limits?.pageSize === 5 &&
  data.limits?.maxPage === 100;
const validDetail = (data, id, page) =>
  mockEnvelope(data) &&
  validClient(data.client) &&
  data.client.externalClientId === id &&
  validSource(data.source) &&
  Array.isArray(data.pendingItems) &&
  data.pendingItems.length <= 5 &&
  data.pendingItems.every(
    item =>
      item &&
      validId(item.id) &&
      typeof item.title === "string" &&
      item.title.length <= 500 &&
      item.status === "pending" &&
      typeof item.periodLabel === "string" &&
      typeof item.dueLabel === "string"
  ) &&
  data.pagination?.page === page &&
  data.pagination.pageSize === 5 &&
  Number.isInteger(data.pagination.total) &&
  data.pagination.total >= 0 &&
  typeof data.pagination.hasMore === "boolean";
const fail = code => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const invalidOutput = () => fail("ERR_ACESSORIAS_INVALID_OUTPUT");
const errorText = error => {
  const suffix = error?.response?.data?.error || error?.code;
  const keys = {
    ERR_ACESSORIAS_DISABLED: "disabled",
    ERR_ACESSORIAS_MANAGE_DENIED: "permission",
    ERR_ACESSORIAS_CLIENT_NOT_LINKED: "notLinked",
    ERR_ACESSORIAS_CLIENT_NOT_FOUND: "notFound",
    ERR_ACESSORIAS_CONTEXT_CHANGED: "contextChanged",
    ERR_ACESSORIAS_FUNCTIONAL_ERROR: "functionalError",
    ERR_ACESSORIAS_INVALID_OUTPUT: "invalidOutput",
    ERR_ACESSORIAS_UPSTREAM_UNAUTHORIZED: "upstreamUnauthorized",
    ERR_ACESSORIAS_RATE_LIMITED: "rateLimited",
    ERR_ACESSORIAS_TIMEOUT: "timeout",
    ERR_ACESSORIAS_UNAVAILABLE: "unavailable",
    ERR_NO_PERMISSION: "permission",
    ERR_NO_TICKET_FOUND: "permission"
  };
  return i18n.t(`acessorias.${keys[suffix] || "requestError"}`);
};

function Panel({ ticketId, contactId, companyId }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const socketManager = useContext(SocketContext);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [linked, setLinked] = useState([]);
  const [linkedSource, setLinkedSource] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState(null);
  const request = useRef({
    sequence: 0,
    controller: null,
    timer: null,
    kind: ""
  });
  const currentTicket = useRef(ticketId);
  currentTicket.current = ticketId;
  const openRef = useRef(open);
  openRef.current = open;
  const base = `/tickets/${ticketId}/acessorias`;

  const invalidate = () => {
    request.current.sequence += 1;
    request.current.controller?.abort();
    clearTimeout(request.current.timer);
    request.current.timer = null;
    request.current.kind = "";
  };
  const execute = async (kind, operation, accept) => {
    invalidate();
    const sequence = request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    request.current.kind = kind;
    setLoading(kind);
    setError("");
    const active = () =>
      request.current.sequence === sequence &&
      currentTicket.current === ticketId &&
      !controller.signal.aborted;
    request.current.timer = setTimeout(() => {
      if (!active()) return;
      invalidate();
      setLoading("");
      setDetail(null);
      setError(i18n.t("acessorias.timeout"));
    }, ACESSORIAS_TIMEOUT_MS);
    try {
      const data = await operation(controller.signal);
      if (active()) accept(data);
    } catch (failure) {
      if (active()) {
        setDetail(null);
        setError(errorText(failure));
        if (failure?.response?.data?.error === "ERR_ACESSORIAS_DISABLED")
          setStatus(previous => previous && { ...previous, enabled: false });
      }
    } finally {
      if (active()) {
        clearTimeout(request.current.timer);
        request.current.timer = null;
        request.current.kind = "";
        setLoading("");
      }
    }
  };
  const getStatus = async signal => {
    const { data } = await api.get(`${base}/status`, { signal });
    if (!validStatus(data)) invalidOutput();
    return data;
  };
  const getLinked = async signal => {
    const { data } = await api.get(`${base}/clients`, { signal });
    if (!validList(data)) invalidOutput();
    return data;
  };
  const clearResults = () => {
    setSelected("");
    setDetail(null);
    setCatalog(null);
    setPage(1);
    setConfirmation(null);
  };
  const loadStatus = () => execute("status", getStatus, setStatus);
  const loadLinked = () => {
    clearResults();
    setLinked([]);
    setLinkedSource(null);
    return execute(
      "clients",
      async signal => {
        const nextStatus = await getStatus(signal);
        if (!nextStatus.enabled || nextStatus.mode !== "mock")
          return { nextStatus, clients: null };
        return { nextStatus, clients: await getLinked(signal) };
      },
      data => {
        setStatus(data.nextStatus);
        if (!data.clients) {
          setError(i18n.t("acessorias.disabled"));
          return;
        }
        setLinked(data.clients.clients);
        setLinkedSource(data.clients.source);
      }
    );
  };

  useEffect(() => {
    loadStatus();
    return invalidate; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ticketId]);
  useEffect(() => {
    if (!socketManager) return undefined;
    const socket = socketManager.GetSocket();
    const changed = setting => {
      if (setting?.key !== "acessoriasEnabled") return;
      invalidate();
      setOpen(false);
      clearResults();
      setLinked([]);
      setLinkedSource(null);
      loadStatus();
    };
    const linksChanged = data => {
      if (Number(data?.contactId) !== Number(contactId) || !openRef.current)
        return;
      invalidate();
      clearResults();
      setLinked([]);
      setLinkedSource(null);
      setError("");
      if (openRef.current) loadLinked();
    };
    socket.on("settings", changed);
    socket.on(`company-${companyId}-acessorias-links`, linksChanged);
    return () => {
      socket.off("settings", changed);
      socket.off(`company-${companyId}-acessorias-links`, linksChanged);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, ticketId, contactId, companyId]);

  const close = () => {
    invalidate();
    setOpen(false);
    setLoading("");
    setError("");
    clearResults();
    setLinked([]);
    setLinkedSource(null);
  };
  const loadDetail = (id, nextPage = 1) => {
    if (!id || !linked.some(client => client.externalClientId === id)) return;
    setSelected(id);
    setPage(nextPage);
    setDetail(null);
    setCatalog(null);
    setConfirmation(null);
    execute(
      "detail",
      async signal => {
        const { data } = await api.get(
          `${base}/clients/${encodeURIComponent(id)}`,
          { params: { page: nextPage }, signal }
        );
        if (!validDetail(data, id, nextPage)) invalidOutput();
        return data;
      },
      setDetail
    );
  };
  const choose = event => {
    const id = event.target.value;
    invalidate();
    setLoading("");
    setDetail(null);
    setError("");
    setSelected(id);
    setCatalog(null);
    setPage(1);
    if (id) loadDetail(id);
  };
  const loadCatalog = () => {
    if (!status?.canManageLinks) return;
    clearResults();
    execute(
      "catalog",
      async signal => {
        const { data } = await api.get(`${base}/catalog`, { signal });
        if (!validList(data)) invalidOutput();
        return data;
      },
      setCatalog
    );
  };
  const changeLink = () => {
    if (!confirmation || request.current.kind || !status?.canManageLinks)
      return;
    const { kind, client } = confirmation;
    clearResults();
    setLinkedSource(null);
    execute(
      "mutation",
      async signal => {
        const response =
          kind === "link"
            ? await api.post(
                `${base}/links`,
                { externalClientId: client.externalClientId },
                { signal }
              )
            : await api.delete(
                `${base}/links/${encodeURIComponent(client.externalClientId)}`,
                { signal }
              );
        const data = response.data;
        if (
          data?.externalClientId !== client.externalClientId ||
          data.linked !== (kind === "link") ||
          typeof data[kind === "link" ? "created" : "deleted"] !== "boolean"
        )
          invalidOutput();
        return getLinked(signal);
      },
      data => {
        setLinked(data.clients);
        setLinkedSource(data.source);
      }
    );
  };
  const source =
    detail?.source ||
    (!selected && !error && !loading ? catalog?.source || linkedSource : null);
  const date = value =>
    new Date(value).toLocaleString(
      (i18n.language || "pt-BR").replace(/_/g, "-")
    );
  const blocked = !!loading && loading !== "detail";
  if ((!status?.enabled || status.mode !== "mock") && !open) return null;

  return (
    <>
      <div className={classes.toolbar}>
        <Button
          size="small"
          startIcon={<BusinessOutlinedIcon />}
          disabled={!!loading}
          aria-label={i18n.t("acessorias.open")}
          onClick={() => {
            setOpen(true);
            loadLinked();
          }}
        >
          {i18n.t("acessorias.button")}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreen}
        aria-labelledby="acessorias-dialog-title"
      >
        <DialogTitle id="acessorias-dialog-title">
          {i18n.t("acessorias.title")}
        </DialogTitle>
        <DialogContent dividers>
          <Chip size="small" label={i18n.t("acessorias.simulation")} />
          <Alert severity="info" className={classes.notice}>
            {i18n.t("acessorias.scope")}
          </Alert>
          <div className={classes.actions}>
            <Button disabled={!!loading} onClick={loadLinked}>
              {i18n.t("acessorias.refreshLinks")}
            </Button>
            {status?.enabled && status.canManageLinks && (
              <Button
                variant="outlined"
                disabled={blocked}
                onClick={loadCatalog}
              >
                {i18n.t("acessorias.linkClient")}
              </Button>
            )}
          </div>
          {!!loading && (
            <Typography component="div" role="status" aria-live="polite">
              <CircularProgress
                size={18}
                aria-label={i18n.t("acessorias.loading")}
              />{" "}
              {i18n.t("acessorias.loading")}
            </Typography>
          )}
          {error && (
            <Alert severity="error" className={classes.notice}>
              {error}
            </Alert>
          )}
          {!linked.length && !loading && !error && (
            <Typography>{i18n.t("acessorias.noLinks")}</Typography>
          )}
          {!!linked.length && (
            <TextField
              id="acessorias-linked-client"
              select
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              variant="outlined"
              margin="normal"
              label={i18n.t("acessorias.selectedClient")}
              value={selected}
              disabled={blocked}
              onChange={choose}
            >
              <option value="">{i18n.t("acessorias.chooseClient")}</option>
              {linked.map(client => (
                <option
                  key={client.externalClientId}
                  value={client.externalClientId}
                >
                  {client.name} — {client.documentLabel}
                </option>
              ))}
            </TextField>
          )}
          {status?.enabled && status.canManageLinks && !!linked.length && (
            <List dense aria-label={i18n.t("acessorias.localLinks")}>
              {linked.map(client => (
                <ListItem key={client.externalClientId} className={classes.row}>
                  <ListItemText
                    className={classes.grow}
                    primary={client.name}
                    secondary={client.documentLabel}
                  />
                  <Button
                    size="small"
                    disabled={blocked}
                    aria-label={i18n.t("acessorias.unlinkNamed", {
                      name: client.name
                    })}
                    onClick={() => setConfirmation({ kind: "unlink", client })}
                  >
                    {i18n.t("acessorias.unlink")}
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
          {catalog && (
            <section
              className={classes.section}
              aria-label={i18n.t("acessorias.catalog")}
            >
              <Typography component="h3" variant="h6">
                {i18n.t("acessorias.catalog")}
              </Typography>
              <List>
                {catalog.clients.map(client => (
                  <ListItem
                    key={client.externalClientId}
                    className={classes.row}
                  >
                    <ListItemText
                      className={classes.grow}
                      primary={client.name}
                      secondary={client.documentLabel}
                    />
                    <Button
                      size="small"
                      disabled={
                        !!loading ||
                        linked.some(
                          link =>
                            link.externalClientId === client.externalClientId
                        )
                      }
                      aria-label={i18n.t("acessorias.linkNamed", {
                        name: client.name
                      })}
                      onClick={() => setConfirmation({ kind: "link", client })}
                    >
                      {linked.some(
                        link =>
                          link.externalClientId === client.externalClientId
                      )
                        ? i18n.t("acessorias.alreadyLinked")
                        : i18n.t("acessorias.link")}
                    </Button>
                  </ListItem>
                ))}
              </List>
            </section>
          )}
          {detail && (
            <section
              className={classes.section}
              aria-label={i18n.t("acessorias.registration")}
            >
              <Typography component="h3" variant="h6">
                {i18n.t("acessorias.registration")}
              </Typography>
              <Typography>{detail.client.name}</Typography>
              <Typography>{detail.client.documentLabel}</Typography>
              <Typography
                component="h3"
                variant="h6"
                className={classes.section}
              >
                {i18n.t("acessorias.pending")}
              </Typography>
              {!detail.pendingItems.length && (
                <Typography>{i18n.t("acessorias.noPending")}</Typography>
              )}
              <List aria-label={i18n.t("acessorias.pending")}>
                {detail.pendingItems.map(item => (
                  <ListItem key={item.id}>
                    <ListItemText
                      primary={item.title}
                      secondary={`${item.periodLabel} · ${item.dueLabel}`}
                    />
                  </ListItem>
                ))}
              </List>
              <div className={classes.actions}>
                <Button
                  disabled={!!loading || page <= 1}
                  onClick={() => loadDetail(selected, page - 1)}
                >
                  {i18n.t("acessorias.previous")}
                </Button>
                <Typography role="status">
                  {i18n.t("acessorias.page", { page })}
                </Typography>
                <Button
                  disabled={
                    !!loading || !detail.pagination.hasMore || page >= 100
                  }
                  onClick={() => loadDetail(selected, page + 1)}
                >
                  {i18n.t("acessorias.next")}
                </Button>
              </div>
            </section>
          )}
          {selected && !detail && !loading && (
            <Button onClick={() => loadDetail(selected, page)}>
              {i18n.t("acessorias.retry")}
            </Button>
          )}
          {source && (
            <section
              className={classes.section}
              aria-label={i18n.t("acessorias.source")}
            >
              <Typography variant="body2">{source.label}</Typography>
              <Typography variant="body2">
                {i18n.t("acessorias.updatedAt", {
                  date: date(source.updatedAt)
                })}
              </Typography>
              <Typography variant="body2">
                {i18n.t("acessorias.fetchedAt", {
                  date: date(source.fetchedAt)
                })}
              </Typography>
              {source.stale && (
                <Alert severity="warning" className={classes.notice}>
                  {i18n.t("acessorias.stale")}
                </Alert>
              )}
            </section>
          )}
        </DialogContent>
        <DialogActions className={classes.footer}>
          {loading === "detail" && (
            <Button
              onClick={() => {
                invalidate();
                setLoading("");
                setDetail(null);
              }}
            >
              {i18n.t("acessorias.cancelQuery")}
            </Button>
          )}
          <Button onClick={close}>{i18n.t("acessorias.close")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="acessorias-confirm-title"
      >
        <DialogTitle id="acessorias-confirm-title">
          {i18n.t(
            confirmation?.kind === "link"
              ? "acessorias.confirmLinkTitle"
              : "acessorias.confirmUnlinkTitle"
          )}
        </DialogTitle>
        <DialogContent>
          <Typography>{confirmation?.client.name}</Typography>
          <Typography>{confirmation?.client.documentLabel}</Typography>
          <Typography className={classes.notice}>
            {i18n.t("acessorias.localOnly")}
          </Typography>
        </DialogContent>
        <DialogActions className={classes.footer}>
          <Button onClick={() => setConfirmation(null)}>
            {i18n.t("acessorias.cancel")}
          </Button>
          <Button color="primary" onClick={changeLink}>
            {i18n.t(
              confirmation?.kind === "link"
                ? "acessorias.confirmLink"
                : "acessorias.confirmUnlink"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function AcessoriasPanel(props) {
  const id = Number(props.ticketId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return (
    <Panel key={`${id}:${props.contactId}:${props.companyId}`} {...props} />
  );
}
