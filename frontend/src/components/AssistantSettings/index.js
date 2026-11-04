import React, { useEffect, useRef, useState } from "react";
import { FormControlLabel, Switch, Typography } from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

export default function AssistantSettings({ settings }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  useEffect(() => {
    const flags = Array.isArray(settings)
      ? settings.filter(setting => setting.key === "aiAssistantEnabled")
      : [];
    setEnabled(
      flags.length > 0 && flags.every(setting => setting.value === "enabled")
    );
    setConflict(new Set(flags.map(setting => setting.value)).size > 1);
  }, [settings]);
  const change = async event => {
    if (busyRef.current) return;
    const next = event.target.checked;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    try {
      await api.put("/settings/aiAssistantEnabled", {
        value: next ? "enabled" : "disabled"
      });
      if (mounted.current) {
        setEnabled(next);
        setConflict(false);
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={busy || !Array.isArray(settings)}
            onChange={change}
            color="primary"
          />
        }
        label={i18n.t("assistant.settingsTitle")}
      />
      <Typography variant="body2">
        {i18n.t("assistant.settingsHint")}
      </Typography>
      {error && (
        <Alert severity="error">{i18n.t("assistant.settingError")}</Alert>
      )}
      {conflict && (
        <Alert severity="warning">{i18n.t("assistant.settingConflict")}</Alert>
      )}
    </div>
  );
}
