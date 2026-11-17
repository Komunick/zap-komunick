import React, { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18nToast } from "../../helpers/i18nToast";
import { i18n } from "../../translate/i18n";

export default function SlaAlertSettings({ queues }) {
  const [config, setConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [queueId, setQueueId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/sla/alert-config"), api.get("/users")])
      .then(([{ data: saved }, { data: accounts }]) => {
        if (!active) return;
        setUsers(accounts.users);
        setConfig(saved);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { enabled, extraRecipientIds, queues: recipients } = config;
      const { data } = await api.put("/sla/alert-config", {
        enabled,
        extraRecipientIds,
        queues: recipients.filter(entry => entry.responsibleIds.length)
      });
      setConfig(data);
      i18nToast.success("settings.success");
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  };

  const accountsForQueue = users.filter(
    user =>
      user.profile === "admin" ||
      user.queues?.some(queue => queue.id === queueId)
  );
  const selectedResponsible = config?.queues.find(
    entry => entry.queueId === queueId
  );
  const displayUser = user => user.name || user.email;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h6" component="h3">
          {i18n.t("slaNotifications.settingsTitle")}
        </Typography>
        <Typography color="textSecondary" variant="body2">
          {i18n.t("slaNotifications.settingsHint")}
        </Typography>
      </Grid>
      {loadError && (
        <Grid item xs={12}>
          <Typography color="error" role="alert">
            {i18n.t("slaNotifications.loadError")}
          </Typography>
        </Grid>
      )}
      {config && (
        <>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.enabled}
                  color="primary"
                  disabled={saving}
                  onChange={event =>
                    setConfig({ ...config, enabled: event.target.checked })
                  }
                />
              }
              label={i18n.t("slaNotifications.enabled")}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              disabled={saving}
              options={users}
              value={users.filter(user =>
                config.extraRecipientIds.includes(user.id)
              )}
              getOptionLabel={displayUser}
              getOptionSelected={(option, value) => option.id === value.id}
              onChange={(_, value) =>
                setConfig({
                  ...config,
                  extraRecipientIds: value.map(user => user.id)
                })
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label={i18n.t("slaNotifications.extraRecipients")}
                  helperText={i18n.t("slaNotifications.extraRecipientsHint")}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <Autocomplete
              id="sla-alert-department"
              disabled={saving}
              options={queues}
              value={queues.find(queue => queue.id === queueId) || null}
              getOptionLabel={queue => queue.name}
              getOptionSelected={(option, value) => option.id === value.id}
              onChange={(_, queue) => setQueueId(queue?.id ?? "")}
              renderInput={params => (
                <TextField
                  {...params}
                  label={i18n.t("slaNotifications.queue")}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={7}>
            <Autocomplete
              id="sla-alert-responsible"
              multiple
              disabled={saving || !queueId}
              options={accountsForQueue}
              value={accountsForQueue.filter(user =>
                selectedResponsible?.responsibleIds.includes(user.id)
              )}
              getOptionLabel={displayUser}
              getOptionSelected={(option, value) => option.id === value.id}
              onChange={(_, value) =>
                setConfig({
                  ...config,
                  queues: [
                    ...config.queues.filter(entry => entry.queueId !== queueId),
                    { queueId, responsibleIds: value.map(user => user.id) }
                  ]
                })
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label={i18n.t("slaNotifications.responsible")}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              disabled={saving}
              onClick={save}
            >
              {i18n.t("slaNotifications.save")}
            </Button>
          </Grid>
        </>
      )}
    </Grid>
  );
}
