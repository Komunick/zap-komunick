import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
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
import FolderOpenOutlined from "@material-ui/icons/FolderOpenOutlined";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import AttachmentViewer from "../AttachmentViewer";
import useAttachmentRequest from "../../hooks/useAttachmentRequest";
import {
  attachmentError,
  attachmentIdentity,
  failAttachment,
  validAttachmentPage,
  validTicketId
} from "../../helpers/attachments";

const useStyles = makeStyles(theme => ({
  opener: {
    margin: theme.spacing(0, 0.5),
    flexShrink: 0,
    alignSelf: "center",
    minWidth: 0
  },
  tools: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  filter: { minWidth: 150 },
  search: { flex: "1 1 220px" },
  row: { gap: theme.spacing(1), alignItems: "center" },
  name: { overflowWrap: "anywhere", minWidth: 0 },
  notice: { marginBottom: theme.spacing(2) },
  footer: { flexWrap: "wrap" }
}));
const t = (key, options) => i18n.t("attachments." + key, options);
const kinds = ["all", "pdf", "image", "video", "other"];

function PanelSession({ ticketId, contextKey }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState(null);
  const { run, cancel } = useAttachmentRequest(contextKey);
  const requestId = useRef(0);
  const invalidate = useCallback(() => {
    ++requestId.current;
    cancel();
  }, [cancel]);
  const load = async (nextCursor = null) => {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const data = await run(async config => {
        const response = await api.get(
          "/tickets/" + ticketId + "/attachments",
          {
            ...config,
            params: {
              kind,
              limit: 20,
              ...(nextCursor ? { cursor: nextCursor } : {})
            }
          }
        );
        if (!validAttachmentPage(response.data))
          failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
        return response.data;
      });
      if (id !== requestId.current) return;
      setItems(previous => {
        const all = nextCursor ? [...previous, ...data.items] : data.items;
        return [
          ...new Map(all.map(item => [attachmentIdentity(item), item])).values()
        ];
      });
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (cause) {
      if (id === requestId.current && cause.code !== "ERR_CANCELED") {
        setItems([]);
        setCursor(null);
        setHasMore(false);
        setSelection(null);
        setError(attachmentError(cause));
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    setSelection(null);
    if (open) load();
    return invalidate;
    // The selected filter starts a new paginated snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, invalidate]);
  const close = () => {
    invalidate();
    setBusy(false);
    setOpen(false);
    setSelection(null);
    setQuery("");
    setItems([]);
  };
  const choose = item => setSelection({ ...item, contextKey });
  const filtered = items.filter(item =>
    item.fileName.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  return (
    <>
      <Button
        className={classes.opener}
        startIcon={<FolderOpenOutlined />}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreen}
        aria-labelledby="attachments-title"
      >
        <DialogTitle id="attachments-title">{t("title")}</DialogTitle>
        <DialogContent>
          <Typography
            color="textSecondary"
            variant="body2"
            className={classes.notice}
          >
            {t("scope")}
          </Typography>
          <div className={classes.tools}>
            <TextField
              id="attachments-filter"
              select
              SelectProps={{ native: true }}
              className={classes.filter}
              label={t("filter")}
              value={kind}
              onChange={event => {
                setItems([]);
                setSelection(null);
                setQuery("");
                setKind(event.target.value);
              }}
            >
              {kinds.map(value => (
                <option key={value} value={value}>
                  {t("kinds." + value)}
                </option>
              ))}
            </TextField>
            <TextField
              id="attachments-search"
              className={classes.search}
              label={t("search")}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          {busy && (
            <Typography component="div" role="status">
              <CircularProgress size={20} /> {t("loading")}
            </Typography>
          )}
          {error && <Alert severity="error">{t(error)}</Alert>}
          {!busy && !error && !filtered.length && (
            <Typography>{t(query ? "noMatches" : "empty")}</Typography>
          )}
          <Button
            disabled={busy}
            onClick={() => {
              setSelection(null);
              setItems([]);
              setCursor(null);
              setHasMore(false);
              load();
            }}
          >
            {t("refresh")}
          </Button>
          <List>
            {filtered.map(item => (
              <ListItem
                key={attachmentIdentity(item)}
                divider
                className={classes.row}
              >
                <ListItemText
                  className={classes.name}
                  primary={item.fileName}
                  secondary={
                    t("kinds." + item.kind) +
                    " · " +
                    (item.sizeBytes === null
                      ? t("unknownSize")
                      : Math.ceil(item.sizeBytes / 1024) + " KB")
                  }
                />
                <Button
                  onClick={() => choose(item)}
                  aria-label={t("viewNamed", {
                    name: item.fileName,
                    interpolation: { escapeValue: false }
                  })}
                >
                  {t("view")}
                </Button>
              </ListItem>
            ))}
          </List>
          {hasMore && (
            <Button disabled={busy} onClick={() => load(cursor)}>
              {t("loadMore")}
            </Button>
          )}
          {error && <Button onClick={() => load()}>{t("retry")}</Button>}
        </DialogContent>
        <DialogActions className={classes.footer}>
          <Button onClick={close}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
      <AttachmentViewer
        open={!!selection}
        ticketId={ticketId}
        contextKey={contextKey}
        selection={selection}
        items={filtered}
        onSelect={choose}
        onClose={() => setSelection(null)}
      />
    </>
  );
}
export default function AttachmentsPanel(props) {
  if (!validTicketId(props.ticketId)) return null;
  return <PanelSession key={props.contextKey} {...props} />;
}
