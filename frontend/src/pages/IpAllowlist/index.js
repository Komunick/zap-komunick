import React, { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Paper from "@material-ui/core/Paper";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { Alert } from "@material-ui/lab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Zap Komunick: company IP restrictions (docs/PRD.md, RF-016).
const useStyles = makeStyles(theme => ({
  content: {
    overflowY: "auto",
    padding: theme.spacing(3),
    width: "100%",
    maxWidth: 800,
    boxSizing: "border-box",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(2) }
  },
  subtitle: { marginBottom: theme.spacing(2) },
  section: { marginTop: theme.spacing(2) },
  currentIp: {
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor: theme.komunick.subtle,
    color: theme.komunick.text,
    overflowWrap: "anywhere"
  },
  actions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(3)
  },
  loading: { display: "flex", alignItems: "center", gap: theme.spacing(1) }
}));

const errorMessage = (err, fallback) => {
  const code = err.response?.data?.error;
  return code && i18n.exists(`backendErrors.${code}`)
    ? i18n.t(`backendErrors.${code}`)
    : i18n.t(fallback);
};

const IpAllowlist = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";
  const [form, setForm] = useState({ enabled: false, text: "" });
  const [saved, setSaved] = useState(null);
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    setError("");
    api
      .get("/security/ip-allowlist")
      .then(({ data }) => {
        if (!active) return;
        const next = { enabled: !!data.enabled, text: data.text || "" };
        setForm(next);
        setSaved(next);
        setIp(data.ip || "");
      })
      .catch(err => {
        if (active) setError(errorMessage(err, "securityIp.loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, reload]);

  const dirty =
    saved && (form.enabled !== saved.enabled || form.text !== saved.text);

  const handleSave = async event => {
    event.preventDefault();
    if (saving || loading || !dirty) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put("/security/ip-allowlist", form);
      if (!mounted.current) return;
      const next = { enabled: !!data.enabled, text: data.text || "" };
      setForm(next);
      setSaved(next);
      setIp(data.ip || "");
      toast.success(i18n.t("securityIp.saved"));
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, "securityIp.saveError"));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const addCurrentIp = () => {
    if (!ip) return;
    setForm(previous => {
      const alreadyIncluded = previous.text
        .split(/[\n,;]+/)
        .some(line => line.split("#")[0].trim() === ip);
      if (alreadyIncluded) return previous;
      return {
        ...previous,
        text: previous.text.trim() ? `${previous.text.trim()}\n${ip}` : ip
      };
    });
  };

  if (!isAdmin) {
    return (
      <MainContainer>
        <Alert severity="warning">{i18n.t("securityIp.onlyAdmin")}</Alert>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("securityIp.title")}</Title>
      </MainHeader>
      <Paper variant="outlined" className={classes.content}>
        <Typography color="textSecondary" className={classes.subtitle}>
          {i18n.t("securityIp.subtitle")}
        </Typography>
        {loading && (
          <div className={classes.loading} role="status">
            <CircularProgress size={22} />
            <span>{i18n.t("securityIp.loading")}</span>
          </div>
        )}
        {error && (
          <Alert
            severity="error"
            action={
              !saved && !loading ? (
                <Button color="inherit" onClick={() => setReload(n => n + 1)}>
                  {i18n.t("securityIp.retry")}
                </Button>
              ) : undefined
            }
          >
            {error}
          </Alert>
        )}
        {saved && !loading && (
          <form onSubmit={handleSave} aria-busy={saving}>
            <div className={classes.currentIp}>
              <Typography variant="body2">
                {i18n.t("securityIp.currentIp", {
                  ip: ip || i18n.t("securityIp.unknownIp")
                })}
              </Typography>
              <Button
                size="small"
                color="primary"
                onClick={addCurrentIp}
                disabled={saving || !ip}
              >
                {i18n.t("securityIp.addCurrent")}
              </Button>
            </div>
            <FormControlLabel
              className={classes.section}
              control={
                <Switch
                  color="primary"
                  checked={form.enabled}
                  onChange={event =>
                    setForm(previous => ({
                      ...previous,
                      enabled: event.target.checked
                    }))
                  }
                  disabled={saving}
                />
              }
              label={i18n.t("securityIp.enabled")}
            />
            <TextField
              className={classes.section}
              fullWidth
              multiline
              minRows={7}
              variant="outlined"
              label={i18n.t("securityIp.listLabel")}
              helperText={i18n.t("securityIp.listHelp")}
              value={form.text}
              onChange={event =>
                setForm(previous => ({ ...previous, text: event.target.value }))
              }
              disabled={saving}
              inputProps={{ spellCheck: false, autoCapitalize: "none" }}
            />
            <div className={classes.actions}>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                disabled={saving || !dirty}
                startIcon={
                  saving ? <CircularProgress color="inherit" size={16} /> : null
                }
              >
                {i18n.t(saving ? "securityIp.saving" : "securityIp.save")}
              </Button>
            </div>
          </form>
        )}
      </Paper>
    </MainContainer>
  );
};

export default IpAllowlist;
