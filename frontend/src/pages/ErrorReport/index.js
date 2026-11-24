import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert, AlertTitle } from "@material-ui/lab";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import CloseIcon from "@material-ui/icons/Close";
import ImageOutlinedIcon from "@material-ui/icons/ImageOutlined";
import MovieOutlinedIcon from "@material-ui/icons/MovieOutlined";
import PictureAsPdfOutlinedIcon from "@material-ui/icons/PictureAsPdfOutlined";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import {
  ERROR_REPORT_ACCEPT,
  ERROR_REPORT_MAX_FILES,
  ERROR_REPORT_MAX_TOTAL_MB,
  addErrorReportFiles,
  megabytes,
  totalBytes
} from "../../helpers/errorReportFiles";

// Zap Komunick: error report of the beta (docs/PRD.md, RF-030).
const TITLE_MAX = 150;
const LOCATION_MAX = 200;
const DESCRIPTION_MAX = 5000;

const useStyles = makeStyles(theme => ({
  content: {
    overflowY: "auto",
    padding: theme.spacing(2),
    maxWidth: 760,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2)
  },
  drop: {
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing(1)
  },
  dropActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover
  },
  hiddenInput: { display: "none" },
  fileName: { wordBreak: "break-word" },
  actions: { display: "flex", alignItems: "center", gap: theme.spacing(2) }
}));

const fileIcon = file => {
  if (file.type === "application/pdf") return <PictureAsPdfOutlinedIcon />;
  if ((file.type || "").startsWith("video/")) return <MovieOutlinedIcon />;
  return <ImageOutlinedIcon />;
};

const requestError = err => {
  const key = `backendErrors.${err.response?.data?.error}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t("errorReport.errors.request");
};

const ErrorReport = () => {
  const classes = useStyles();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentId, setSentId] = useState(null);
  const filesRef = useRef(files);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const inputRef = useRef(null);

  filesRef.current = files;

  const addFiles = incoming => {
    if (!incoming.length || busyRef.current) return;
    const { files: next, rejected } = addErrorReportFiles(
      filesRef.current,
      incoming
    );
    filesRef.current = next;
    setFiles(next);
    setError(
      rejected
        ? i18n.t(`errorReport.errors.${rejected.code}`, {
            name: rejected.name,
            count: ERROR_REPORT_MAX_FILES,
            size: ERROR_REPORT_MAX_TOTAL_MB
          })
        : ""
    );
  };

  useEffect(() => {
    mounted.current = true;
    // A screenshot copied with Print Screen can be pasted anywhere on the page.
    const onPaste = event => {
      const pasted = Array.from(event.clipboardData?.files || []);
      if (!pasted.length) return;
      event.preventDefault();
      addFiles(pasted);
    };
    document.addEventListener("paste", onPaste);
    return () => {
      mounted.current = false;
      document.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeFile = index => {
    const next = files.filter((_, position) => position !== index);
    filesRef.current = next;
    setFiles(next);
    setError("");
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (busyRef.current) return;
    if (!title.trim() || !description.trim()) {
      setError(i18n.t("errorReport.errors.required"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("location", location.trim());
      form.append("description", description.trim());
      form.append("screen", `${window.innerWidth}x${window.innerHeight}`);
      form.append("appUrl", window.location.origin);
      files.forEach(file => form.append("files", file, file.name));
      const { data } = await api.post("/error-reports", form);
      if (!mounted.current) return;
      setSentId(data.id);
      setTitle("");
      setLocation("");
      setDescription("");
      filesRef.current = [];
      setFiles([]);
    } catch (err) {
      if (mounted.current) setError(requestError(err));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (sentId !== null) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>{i18n.t("errorReport.title")}</Title>
        </MainHeader>
        <Paper className={classes.content} variant="outlined">
          <Alert severity="success" role="status">
            <AlertTitle>{i18n.t("errorReport.sentTitle")}</AlertTitle>
            {i18n.t("errorReport.sent", { id: sentId })}
          </Alert>
          <div>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setSentId(null)}
            >
              {i18n.t("errorReport.another")}
            </Button>
          </div>
        </Paper>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("errorReport.title")}</Title>
      </MainHeader>
      <Paper
        className={classes.content}
        variant="outlined"
        component="form"
        onSubmit={handleSubmit}
        noValidate
      >
        <Typography variant="body2" color="textSecondary">
          {i18n.t("errorReport.intro")}
        </Typography>
        <TextField
          id="error-report-title"
          label={i18n.t("errorReport.fields.title")}
          helperText={i18n.t("errorReport.fields.titleHelp")}
          value={title}
          onChange={event => setTitle(event.target.value)}
          inputProps={{ maxLength: TITLE_MAX }}
          variant="outlined"
          margin="dense"
          required
          fullWidth
          disabled={busy}
        />
        <TextField
          id="error-report-location"
          label={i18n.t("errorReport.fields.location")}
          helperText={i18n.t("errorReport.fields.locationHelp")}
          value={location}
          onChange={event => setLocation(event.target.value)}
          inputProps={{ maxLength: LOCATION_MAX }}
          variant="outlined"
          margin="dense"
          fullWidth
          disabled={busy}
        />
        <TextField
          id="error-report-description"
          label={i18n.t("errorReport.fields.description")}
          helperText={i18n.t("errorReport.fields.descriptionHelp")}
          value={description}
          onChange={event => setDescription(event.target.value)}
          inputProps={{ maxLength: DESCRIPTION_MAX }}
          variant="outlined"
          margin="dense"
          multiline
          minRows={5}
          maxRows={14}
          required
          fullWidth
          disabled={busy}
        />
        <div>
          <Typography variant="subtitle2" gutterBottom>
            {i18n.t("errorReport.attachments.title")}
          </Typography>
          <div
            className={`${classes.drop} ${dragging ? classes.dropActive : ""}`}
            data-testid="error-report-drop"
            onDragOver={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              addFiles(Array.from(event.dataTransfer?.files || []));
            }}
          >
            <Typography variant="body2">
              {i18n.t("errorReport.attachments.drop")}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {i18n.t("errorReport.attachments.choose")}
            </Button>
            <input
              ref={inputRef}
              className={classes.hiddenInput}
              type="file"
              multiple
              accept={ERROR_REPORT_ACCEPT}
              aria-label={i18n.t("errorReport.attachments.choose")}
              onChange={event => {
                addFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            <Typography variant="caption" color="textSecondary">
              {i18n.t("errorReport.attachments.limits", {
                count: ERROR_REPORT_MAX_FILES,
                size: ERROR_REPORT_MAX_TOTAL_MB
              })}
            </Typography>
          </div>
          {files.length > 0 && (
            <>
              <List dense>
                {files.map((file, index) => (
                  <ListItem key={`${file.name}-${index}`}>
                    <ListItemIcon>{fileIcon(file)}</ListItemIcon>
                    <ListItemText
                      className={classes.fileName}
                      primary={file.name}
                      secondary={`${megabytes(file.size)} MB`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        aria-label={i18n.t("errorReport.attachments.remove", {
                          name: file.name
                        })}
                        onClick={() => removeFile(index)}
                        disabled={busy}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("errorReport.attachments.total", {
                  used: megabytes(totalBytes(files)),
                  size: ERROR_REPORT_MAX_TOTAL_MB
                })}
              </Typography>
            </>
          )}
        </div>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
        <div className={classes.actions}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={busy}
          >
            {busy
              ? i18n.t("errorReport.sending")
              : i18n.t("errorReport.submit")}
          </Button>
          {busy && <CircularProgress size={20} />}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default ErrorReport;
