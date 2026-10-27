import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Zap Komunick P0: the browser receives status only; replacement values live in
// this form's memory until saved. Never hydrate the field from company.settings.
const useStyles = makeStyles(theme => ({
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  notice: { marginTop: theme.spacing(1) }
}));

const publicStatus = data => ({
  configured: data.configured === true,
  migrationPending: data.migrationPending === true,
  masterKeyConfigured: data.masterKeyConfigured === true
});

const requestError = err => {
  const key = `backendErrors.${err.response?.data?.error}`;
  return i18n.exists(key)
    ? i18n.t(key)
    : i18n.t("settings.credentials.requestError");
};

export default function CompanyCredentialSettings() {
  const classes = useStyles();
  const [status, setStatus] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mounted = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    api
      .get("/credentials/openAiKey")
      .then(({ data }) => {
        if (mounted.current) setStatus(publicStatus(data));
      })
      .catch(err => {
        if (mounted.current) setError(requestError(err));
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async operation => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const nextStatus = await operation();
      if (!mounted.current) return;
      setStatus(publicStatus(nextStatus));
      setValue("");
      setConfirmDelete(false);
      setNotice(i18n.t("settings.credentials.saved"));
    } catch (err) {
      if (mounted.current) setError(requestError(err));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const { data } = await api.put("/credentials/openAiKey", {
        value: value.trim()
      });
      return data;
    });

  const remove = () =>
    run(async () => {
      const { data } = await api.delete("/credentials/openAiKey");
      return data;
    });

  const migrate = () =>
    run(async () => {
      await api.post("/credentials/migrate");
      const { data } = await api.get("/credentials/openAiKey");
      return data;
    });

  const statusText = !status
    ? error
      ? "unavailable"
      : "loading"
    : status.migrationPending
      ? "migrationPending"
      : status.configured
        ? "configured"
        : "notConfigured";

  return (
    <div>
      <TextField
        id="openai-key-field"
        label={i18n.t("settings.credentials.aiKey")}
        type="password"
        variant="standard"
        fullWidth
        autoComplete="new-password"
        value={value}
        disabled={busy || !status || !status.masterKeyConfigured}
        onChange={event => setValue(event.target.value)}
        helperText={i18n.t(`settings.credentials.${statusText}`)}
      />
      {status && !status.masterKeyConfigured && (
        <Alert severity="warning" className={classes.notice}>
          {i18n.t("settings.credentials.storageUnavailable")}
        </Alert>
      )}
      {error && (
        <Alert severity="error" className={classes.notice}>
          {error}
        </Alert>
      )}
      {notice && (
        <Typography role="status" className={classes.notice}>
          {notice}
        </Typography>
      )}
      <div className={classes.actions}>
        <Button
          variant="contained"
          color="primary"
          disabled={
            busy || !status?.masterKeyConfigured || !value.trim().length
          }
          onClick={save}
        >
          {i18n.t("settings.credentials.save")}
        </Button>
        <Button
          disabled={busy || !status?.configured}
          onClick={() => setConfirmDelete(true)}
        >
          {i18n.t("settings.credentials.remove")}
        </Button>
        {status?.migrationPending && (
          <Button
            disabled={busy || !status.masterKeyConfigured}
            onClick={migrate}
          >
            {i18n.t("settings.credentials.migrate")}
          </Button>
        )}
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        aria-labelledby="credential-remove-title"
      >
        <DialogTitle id="credential-remove-title">
          {i18n.t("settings.credentials.remove")}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {i18n.t("settings.credentials.removeWarning")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmDelete(false)}>
            {i18n.t("settings.credentials.cancel")}
          </Button>
          <Button disabled={busy} color="primary" onClick={remove}>
            {i18n.t("settings.credentials.confirmRemove")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
