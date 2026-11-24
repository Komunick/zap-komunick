import React, { useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import PdfAttachmentView from "../../components/PdfAttachmentView";
import {
  attachmentKind,
  attachmentUrl,
  megabytes
} from "../../helpers/supportTickets";
import { kindIcon } from "./DraftFiles";

// Zap Komunick: attachments of a support message (RF-030). The files only
// leave the server through the authenticated route, so they are fetched with
// the session and shown from memory.
const useStyles = makeStyles(theme => ({
  list: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.75)
  },
  thumbButton: {
    padding: 0,
    border: "none",
    background: "none",
    cursor: "pointer",
    borderRadius: 8,
    overflow: "hidden",
    lineHeight: 0
  },
  thumb: {
    display: "block",
    maxWidth: 220,
    maxHeight: 160,
    objectFit: "cover",
    borderRadius: 8
  },
  placeholder: {
    width: 120,
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover
  },
  chip: { maxWidth: "100%" },
  viewer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200
  },
  media: { maxWidth: "100%", maxHeight: "70vh" }
}));

const useAttachmentBlob = (ticketId, attachment, enabled) => {
  const [state, setState] = useState({ blob: null, url: "", error: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let objectUrl = "";
    setState({ blob: null, url: "", error: false });
    api
      .get(attachmentUrl(ticketId, attachment.id), { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        // The type comes from the ticket data, never from the response body.
        const blob = new Blob([data], { type: attachment.mimeType });
        objectUrl = URL.createObjectURL(blob);
        setState({ blob, url: objectUrl, error: false });
      })
      .catch(() => {
        if (active) setState({ blob: null, url: "", error: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ticketId, attachment.id, attachment.mimeType, enabled]);

  return state;
};

const Viewer = ({ ticketId, attachment, onClose }) => {
  const classes = useStyles();
  const { blob, url, error } = useAttachmentBlob(ticketId, attachment, true);
  const kind = attachmentKind(attachment.mimeType);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{attachment.name}</DialogTitle>
      <DialogContent dividers>
        <div className={classes.viewer}>
          {error && (
            <Alert severity="error" role="alert">
              {i18n.t("support.attachments.loadError")}
            </Alert>
          )}
          {!error && !url && <CircularProgress />}
          {url && kind === "image" && (
            <img className={classes.media} src={url} alt={attachment.name} />
          )}
          {url && kind === "video" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video className={classes.media} src={url} controls />
          )}
          {blob && kind === "pdf" && (
            <PdfAttachmentView blob={blob} fileName={attachment.name} />
          )}
        </div>
      </DialogContent>
      <DialogActions>
        {url && (
          <Button component="a" href={url} download={attachment.name}>
            {i18n.t("support.attachments.download")}
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          {i18n.t("support.attachments.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Thumbnail = ({ ticketId, attachment, onOpen }) => {
  const classes = useStyles();
  const { url, error } = useAttachmentBlob(ticketId, attachment, true);
  const label = i18n.t("support.attachments.open", { name: attachment.name });

  if (error)
    return (
      <Chip
        className={classes.chip}
        size="small"
        variant="outlined"
        icon={kindIcon(attachment.mimeType)}
        label={attachment.name}
        onClick={onOpen}
      />
    );
  return (
    <button
      type="button"
      className={classes.thumbButton}
      onClick={onOpen}
      aria-label={label}
      title={attachment.name}
    >
      {url ? (
        <img className={classes.thumb} src={url} alt={attachment.name} />
      ) : (
        <span className={classes.placeholder}>
          <CircularProgress size={20} />
        </span>
      )}
    </button>
  );
};

const MessageAttachments = ({ ticketId, attachments }) => {
  const classes = useStyles();
  const [open, setOpen] = useState(null);
  if (!attachments?.length) return null;

  return (
    <div className={classes.list}>
      {attachments.map(attachment =>
        attachmentKind(attachment.mimeType) === "image" ? (
          <Thumbnail
            key={attachment.id}
            ticketId={ticketId}
            attachment={attachment}
            onOpen={() => setOpen(attachment)}
          />
        ) : (
          <Chip
            key={attachment.id}
            className={classes.chip}
            size="small"
            variant="outlined"
            icon={kindIcon(attachment.mimeType)}
            label={`${attachment.name} · ${megabytes(attachment.size)} MB`}
            aria-label={i18n.t("support.attachments.open", {
              name: attachment.name
            })}
            onClick={() => setOpen(attachment)}
          />
        )
      )}
      {open && (
        <Viewer
          ticketId={ticketId}
          attachment={open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
};

export default MessageAttachments;
