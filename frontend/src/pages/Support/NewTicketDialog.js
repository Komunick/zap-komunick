import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import {
  SUPPORT_ACCEPT,
  SUPPORT_BODY_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_LOCATION_MAX,
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_TOTAL_MB,
  SUPPORT_PRIORITIES,
  SUPPORT_TITLE_MAX
} from "../../helpers/supportTickets";
import DraftFiles from "./DraftFiles";
import useAttachmentDraft from "./useAttachmentDraft";

// Zap Komunick: form that opens a support ticket (RF-030).
const useStyles = makeStyles(theme => ({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5)
  },
  row: { display: "flex", flexWrap: "wrap", gap: theme.spacing(1.5) },
  half: { flex: "1 1 200px" },
  hidden: { display: "none" },
  dropping: { outline: `2px dashed ${theme.palette.primary.main}` }
}));

export const requestError = err => {
  const key = `backendErrors.${err.response?.data?.error}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t("support.requestError");
};

const NewTicketDialog = ({ open, onClose, onCreated }) => {
  const classes = useStyles();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("error");
  const [priority, setPriority] = useState("medium");
  const [blocking, setBlocking] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dropping, setDropping] = useState(false);
  const draft = useAttachmentDraft();
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const inputRef = useRef(null);
  const addFiles = draft.add;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    // A screenshot copied with Print Screen can be pasted anywhere in the form.
    const onPaste = event => {
      const pasted = Array.from(event.clipboardData?.files || []);
      if (!pasted.length) return;
      event.preventDefault();
      addFiles(pasted);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, addFiles]);

  const reset = () => {
    setTitle("");
    setCategory("error");
    setPriority("medium");
    setBlocking(false);
    setLocation("");
    setDescription("");
    setError("");
    draft.clear();
  };

  const handleClose = () => {
    if (busyRef.current) return;
    onClose();
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (busyRef.current) return;
    if (!title.trim()) {
      setError(i18n.t("support.form.required"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("category", category);
      form.append("priority", blocking ? "critical" : priority);
      form.append("location", location.trim());
      form.append("description", description.trim());
      form.append("screen", `${window.innerWidth}x${window.innerHeight}`);
      form.append("appUrl", window.location.origin);
      draft.files.forEach(file => form.append("files", file, file.name));
      const { data } = await api.post("/support/tickets", form);
      if (!mounted.current) return;
      reset();
      onCreated(data);
    } catch (err) {
      if (mounted.current) setError(requestError(err));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="support-new-ticket-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="support-new-ticket-title">
          {i18n.t("support.form.heading")}
        </DialogTitle>
        <DialogContent
          dividers
          className={`${classes.content} ${dropping ? classes.dropping : ""}`}
          data-testid="support-new-ticket-drop"
          onDragOver={event => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={event => {
            event.preventDefault();
            setDropping(false);
            addFiles(Array.from(event.dataTransfer?.files || []));
          }}
        >
          <Typography variant="body2" color="textSecondary">
            {i18n.t("support.form.intro")}
          </Typography>
          <TextField
            id="support-ticket-title"
            label={i18n.t("support.form.title")}
            helperText={i18n.t("support.form.titleHelp")}
            value={title}
            onChange={event => setTitle(event.target.value)}
            inputProps={{ maxLength: SUPPORT_TITLE_MAX }}
            variant="outlined"
            margin="dense"
            required
            fullWidth
            autoFocus
            disabled={busy}
          />
          <div className={classes.row}>
            <TextField
              id="support-ticket-category"
              className={classes.half}
              select
              label={i18n.t("support.category.label")}
              value={category}
              onChange={event => setCategory(event.target.value)}
              variant="outlined"
              margin="dense"
              disabled={busy}
            >
              {SUPPORT_CATEGORIES.map(option => (
                <MenuItem key={option} value={option}>
                  {i18n.t(`support.category.${option}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              id="support-ticket-priority"
              className={classes.half}
              select
              label={i18n.t("support.priority.label")}
              value={blocking ? "critical" : priority}
              onChange={event => setPriority(event.target.value)}
              variant="outlined"
              margin="dense"
              disabled={busy || blocking}
            >
              {SUPPORT_PRIORITIES.map(option => (
                <MenuItem key={option} value={option}>
                  {i18n.t(`support.priority.${option}`)}
                </MenuItem>
              ))}
              {blocking && (
                <MenuItem value="critical">
                  {i18n.t("support.priority.critical")}
                </MenuItem>
              )}
            </TextField>
          </div>
          <FormControlLabel
            control={
              <Checkbox
                checked={blocking}
                onChange={event => setBlocking(event.target.checked)}
                color="primary"
                disabled={busy}
              />
            }
            label={i18n.t("support.form.blocking")}
          />
          <TextField
            id="support-ticket-location"
            label={i18n.t("support.form.location")}
            value={location}
            onChange={event => setLocation(event.target.value)}
            inputProps={{ maxLength: SUPPORT_LOCATION_MAX }}
            variant="outlined"
            margin="dense"
            fullWidth
            disabled={busy}
          />
          <TextField
            id="support-ticket-description"
            label={i18n.t("support.form.description")}
            helperText={i18n.t("support.form.descriptionHelp")}
            value={description}
            onChange={event => setDescription(event.target.value)}
            inputProps={{ maxLength: SUPPORT_BODY_MAX }}
            variant="outlined"
            margin="dense"
            multiline
            minRows={4}
            maxRows={10}
            fullWidth
            disabled={busy}
          />
          <div>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {i18n.t("support.attachments.add")}
            </Button>
            <input
              ref={inputRef}
              className={classes.hidden}
              type="file"
              multiple
              accept={SUPPORT_ACCEPT}
              aria-label={i18n.t("support.attachments.add")}
              onChange={event => {
                addFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
          </div>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("support.attachments.limits", {
              count: SUPPORT_MAX_FILES,
              size: SUPPORT_MAX_TOTAL_MB
            })}
          </Typography>
          <DraftFiles
            files={draft.files}
            onRemove={draft.remove}
            disabled={busy}
          />
          {(error || draft.error) && (
            <Alert severity="error" role="alert">
              {error || draft.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={busy}>
            {i18n.t("support.form.cancel")}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={busy}
          >
            {busy
              ? i18n.t("support.form.sending")
              : i18n.t("support.form.submit")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NewTicketDialog;
