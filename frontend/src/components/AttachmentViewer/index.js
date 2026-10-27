import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import {
  Close,
  GetApp,
  RotateLeft,
  RotateRight,
  ZoomIn,
  ZoomOut
} from "@material-ui/icons";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";
import PdfAttachmentView from "../PdfAttachmentView";
import useAttachmentRequest from "../../hooks/useAttachmentRequest";
import {
  MAX_ATTACHMENT_BYTES,
  attachmentError,
  attachmentIdentity,
  attachmentPath,
  failAttachment,
  previewMimeAllowed,
  safeOriginalUrl,
  validAttachment,
  validTicketId
} from "../../helpers/attachments";

const useStyles = makeStyles(theme => ({
  content: {
    minHeight: 240,
    background: theme.komunick?.subtle || theme.palette.background.default,
    overflowWrap: "anywhere"
  },
  title: { display: "flex", alignItems: "center", gap: theme.spacing(1) },
  name: { flex: 1, minWidth: 0, overflowWrap: "anywhere" },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  viewport: {
    overflow: "auto",
    maxHeight: "65vh",
    padding: theme.spacing(2),
    textAlign: "center"
  },
  image: {
    maxWidth: "100%",
    maxHeight: "55vh",
    objectFit: "contain",
    transformOrigin: "center"
  },
  video: { width: "100%", maxHeight: "65vh", display: "block" },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(4)
  },
  footer: { flexWrap: "wrap" }
}));
const t = (key, options) => i18n.t("attachments." + key, options);

function ViewerSession({ ticketId, selection, items, onSelect, onClose }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { run, cancel } = useAttachmentRequest(attachmentIdentity(selection));
  const socketManager = useContext(SocketContext);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [invalidated, setInvalidated] = useState(false);
  const activeSession = useRef(true);
  useEffect(
    () => () => {
      activeSession.current = false;
    },
    []
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [url, setUrl] = useState(null);
  const path = attachmentPath(ticketId, selection);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    setBusy(true);
    run(async config => {
      const { data: item } = await api.get(path, config);
      if (config.signal.aborted) failAttachment("ERR_CANCELED");
      if (
        !validAttachment(item) ||
        attachmentIdentity(item) !== attachmentIdentity(selection)
      )
        failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      if (
        !item.previewSupported ||
        item.storage !== "local" ||
        item.previewReason !== "available"
      )
        return { item, blob: null };
      if (!previewMimeAllowed(item.kind, item.mimeType))
        failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      if (item.sizeBytes !== null && item.sizeBytes > MAX_ATTACHMENT_BYTES)
        failAttachment("ERR_ATTACHMENT_TOO_LARGE");
      const head = await api.head(path + "/content", config);
      if (config.signal.aborted) failAttachment("ERR_CANCELED");
      const rawLength = head.headers?.["content-length"];
      const length = rawLength == null ? NaN : Number(rawLength);
      if (!Number.isSafeInteger(length) || length < 0)
        failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      if (length > MAX_ATTACHMENT_BYTES)
        failAttachment("ERR_ATTACHMENT_TOO_LARGE");
      const { data: blob } = await api.get(path + "/content", {
        ...config,
        responseType: "blob"
      });
      if (!(blob instanceof Blob) || blob.size > MAX_ATTACHMENT_BYTES)
        failAttachment(
          blob?.size > MAX_ATTACHMENT_BYTES
            ? "ERR_ATTACHMENT_TOO_LARGE"
            : "ERR_ATTACHMENT_INVALID_OUTPUT"
        );
      const mime = blob.type.toLowerCase().split(";")[0];
      if (!previewMimeAllowed(item.kind, mime))
        failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      return { item, blob };
    })
      .then(data => {
        if (active) setResult(data);
      })
      .catch(cause => {
        if (active && cause.code !== "ERR_CANCELED")
          setError(attachmentError(cause));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      cancel();
    };
  }, [path, selection, run, cancel]);
  useEffect(() => {
    if (!result?.blob) return;
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result]);
  useEffect(() => {
    if (!socketManager?.GetSocket) return;
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);
    const event = "company-" + companyId + "-appMessage";
    const changed = data => {
      if (!["update", "delete"].includes(data?.action)) return;
      const message = data.message;
      const messageId = message?.id ?? data.messageId;
      const sourceTicketId = message?.ticketId ?? data.ticketId;
      if (
        messageId !== selection.messageId ||
        Number(sourceTicketId) !== Number(selection.sourceTicketId)
      )
        return;
      cancel();
      setResult(null);
      setInvalidated(true);
      closeRef.current();
    };
    socket.on(event, changed);
    return () => {
      socket.off(event, changed);
      socket.disconnect();
    };
  }, [socketManager, selection.messageId, selection.sourceTicketId, cancel]);

  const openOriginal = async () => {
    setBusy(true);
    setError("");
    try {
      const item = await run(async config => {
        const response = await api.get(path, config);
        const fresh = response.data;
        if (
          !validAttachment(fresh) ||
          attachmentIdentity(fresh) !== attachmentIdentity(selection)
        )
          failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
        return fresh;
      });
      if (
        item.storage === "unavailable" ||
        !["external", "too_large", "unsupported"].includes(item.previewReason)
      )
        failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      const original = safeOriginalUrl(item.legacyUrl);
      if (!original) failAttachment("ERR_ATTACHMENT_INVALID_OUTPUT");
      window.open(original, "_blank", "noopener,noreferrer");
    } catch (cause) {
      if (cause.code !== "ERR_CANCELED") {
        setResult(null);
        setError(attachmentError(cause));
      }
    } finally {
      if (activeSession.current) setBusy(false);
    }
  };
  const download = () => {
    if (!url || !result?.blob || busy || error) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = Array.from(result.item.fileName, character =>
      character.charCodeAt(0) < 32 || character === "/" || character === "\\"
        ? "_"
        : character
    ).join("");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  const index = items.findIndex(
    item => attachmentIdentity(item) === attachmentIdentity(selection)
  );
  const canOriginal =
    result &&
    !result.blob &&
    result.item.storage !== "unavailable" &&
    ["external", "too_large", "unsupported"].includes(
      result.item.previewReason
    ) &&
    safeOriginalUrl(result.item.legacyUrl);
  if (invalidated) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      aria-labelledby="attachment-viewer-title"
    >
      <DialogTitle disableTypography className={classes.title}>
        <Typography
          component="h2"
          variant="h6"
          className={classes.name}
          id="attachment-viewer-title"
        >
          {result?.item.fileName || selection.fileName || t("title")}
        </Typography>
        <IconButton onClick={onClose} aria-label={t("closeViewer")}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        {busy && (
          <div role="status" className={classes.loading}>
            <CircularProgress size={24} />
            {t("loading")}
          </div>
        )}
        {error && <Alert severity="error">{t(error)}</Alert>}
        {!busy && !error && result && !result.blob && (
          <Alert severity="info">
            {t("reason." + result.item.previewReason)}
          </Alert>
        )}
        {!busy && !error && result?.blob && (
          <>
            {result.item.kind === "pdf" && (
              <PdfAttachmentView
                blob={result.blob}
                fileName={result.item.fileName}
              />
            )}
            {result.item.kind === "image" && url && (
              <>
                <div className={classes.controls}>
                  <IconButton
                    aria-label={t("zoomOut")}
                    onClick={() =>
                      setZoom(value => Math.max(0.5, value - 0.25))
                    }
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut />
                  </IconButton>
                  <IconButton
                    aria-label={t("zoomIn")}
                    onClick={() => setZoom(value => Math.min(3, value + 0.25))}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn />
                  </IconButton>
                  <IconButton
                    aria-label={t("rotateLeft")}
                    onClick={() => setRotation(value => value - 90)}
                  >
                    <RotateLeft />
                  </IconButton>
                  <IconButton
                    aria-label={t("rotateRight")}
                    onClick={() => setRotation(value => value + 90)}
                  >
                    <RotateRight />
                  </IconButton>
                </div>
                <div className={classes.viewport}>
                  <img
                    className={classes.image}
                    src={url}
                    alt={result.item.fileName}
                    style={{
                      transform:
                        "rotate(" + rotation + "deg) scale(" + zoom + ")"
                    }}
                    onError={() => setMediaError(true)}
                  />
                </div>
              </>
            )}
            {result.item.kind === "video" && url && (
              <video
                className={classes.video}
                src={url}
                controls
                playsInline
                preload="metadata"
                onError={() => setMediaError(true)}
                aria-label={result.item.fileName}
              />
            )}
            {mediaError && (
              <Alert severity="warning">
                {t(result.item.kind === "video" ? "codec" : "failed")}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions className={classes.footer}>
        <Button
          onClick={() => onSelect(items[index - 1])}
          disabled={index <= 0 || busy}
        >
          {t("previous")}
        </Button>
        <Button
          onClick={() => onSelect(items[index + 1])}
          disabled={index < 0 || index >= items.length - 1 || busy}
        >
          {t("next")}
        </Button>
        {canOriginal && !error && (
          <Button disabled={busy} onClick={openOriginal}>
            {t("openOriginal")}
          </Button>
        )}
        {result?.blob && !error && (
          <Button
            disabled={busy || !url}
            startIcon={<GetApp />}
            onClick={download}
          >
            {t("download")}
          </Button>
        )}
        <Button onClick={onClose}>{t("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AttachmentViewer({
  open,
  ticketId,
  contextKey,
  selection,
  ...props
}) {
  if (
    !open ||
    !validTicketId(ticketId) ||
    !selection ||
    selection.contextKey !== contextKey
  )
    return null;
  return (
    <ViewerSession
      key={contextKey + ":" + attachmentIdentity(selection)}
      ticketId={ticketId}
      selection={selection}
      {...props}
    />
  );
}
