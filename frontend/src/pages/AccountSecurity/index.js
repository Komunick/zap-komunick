import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode.react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Zap Komunick: the secret and recovery codes live only in this page's memory (RF-016).
const useStyles = makeStyles(theme => ({
  content: { overflowY: "auto", padding: theme.spacing(2), maxWidth: 760 },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2)
  },
  block: { marginTop: theme.spacing(2) },
  qr: {
    display: "inline-flex",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.common.white,
    marginTop: theme.spacing(2)
  },
  codes: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(1),
    fontFamily: "monospace",
    padding: theme.spacing(2),
    backgroundColor: theme.komunick.subtle,
    borderRadius: 8
  }
}));

const errorText = err => {
  const key = `backendErrors.${err.response?.data?.error}`;
  return i18n.exists(key)
    ? i18n.t(key)
    : i18n.t("accountSecurity.requestError");
};

const AccountSecurity = () => {
  const classes = useStyles();
  const theme = useTheme();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  useEffect(() => {
    mounted.current = true;
    api
      .get("/security/me")
      .then(({ data }) => {
        if (mounted.current) setStatus(data);
      })
      .catch(err => {
        if (mounted.current) setError(errorText(err));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async fn => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      if (mounted.current) setError(errorText(err));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const { data } = await api.post("/security/2fa/setup");
      if (mounted.current) {
        setSetup(data);
        setCode("");
      }
    });

  const enable = event => {
    event.preventDefault();
    run(async () => {
      const { data } = await api.post("/security/2fa/enable", { code });
      if (!mounted.current) return;
      setStatus(prev => ({
        ...prev,
        twoFactorEnabled: true,
        recoveryCodesLeft: data.recoveryCodes.length
      }));
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
    });
  };

  const openAction = next => {
    setAction(next);
    setCode("");
    setPassword("");
    setError("");
  };
  const closeAction = () => {
    if (!busyRef.current) {
      setAction(null);
      setCode("");
      setPassword("");
      setError("");
    }
  };
  const submitAction = event => {
    event.preventDefault();
    run(async () => {
      if (action === "disable") {
        await api.post("/security/2fa/disable", { password, code });
        if (!mounted.current) return;
        setStatus(prev => ({
          ...prev,
          twoFactorEnabled: false,
          recoveryCodesLeft: 0
        }));
      } else {
        const { data } = await api.post("/security/2fa/recovery-codes", {
          code
        });
        if (!mounted.current) return;
        setStatus(prev => ({
          ...prev,
          recoveryCodesLeft: data.recoveryCodes.length
        }));
        setRecoveryCodes(data.recoveryCodes);
      }
      setAction(null);
      setCode("");
      setPassword("");
    });
  };

  const download = () => {
    const blob = new Blob(
      [
        `${i18n.t("accountSecurity.recoveryTitle")}\n\n${recoveryCodes.join("\n")}\n`
      ],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zap-komunick-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("accountSecurity.title")}</Title>
      </MainHeader>
      <Paper className={classes.content} variant="outlined">
        {loading && (
          <CircularProgress
            aria-label={i18n.t("accountSecurity.loading")}
            size={24}
          />
        )}
        {!action && error && <Alert severity="error">{error}</Alert>}
        {!loading && !status && (
          <Button onClick={() => window.location.reload()}>
            {i18n.t("accountSecurity.retry")}
          </Button>
        )}
        {status && (
          <>
            <Typography variant="h6">
              {i18n.t("accountSecurity.twoFactorTitle")}
            </Typography>
            <Typography color="textSecondary" paragraph>
              {i18n.t("accountSecurity.description")}
            </Typography>
            <Chip
              color={status.twoFactorEnabled ? "primary" : "default"}
              label={i18n.t(
                status.twoFactorEnabled
                  ? "accountSecurity.enabled"
                  : "accountSecurity.disabled"
              )}
            />
            {status.twoFactorEnabled ? (
              <>
                <Typography className={classes.block}>
                  {i18n.t("accountSecurity.remaining", {
                    count: status.recoveryCodesLeft
                  })}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("accountSecurity.freshCode")}
                </Typography>
                <div className={classes.row}>
                  <Button
                    variant="outlined"
                    onClick={() => openAction("recovery")}
                    disabled={busy}
                  >
                    {i18n.t("accountSecurity.regenerate")}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => openAction("disable")}
                    disabled={busy}
                  >
                    {i18n.t("accountSecurity.disable")}
                  </Button>
                </div>
              </>
            ) : (
              !setup && (
                <div className={classes.row}>
                  <Button
                    color="primary"
                    variant="contained"
                    onClick={start}
                    disabled={busy}
                  >
                    {i18n.t("accountSecurity.start")}
                  </Button>
                </div>
              )
            )}
            {setup && (
              <form onSubmit={enable} className={classes.block}>
                <Typography>{i18n.t("accountSecurity.scan")}</Typography>
                <div
                  className={classes.qr}
                  role="img"
                  aria-label={i18n.t("accountSecurity.qrLabel")}
                >
                  <QRCode
                    value={setup.uri}
                    size={180}
                    renderAs="svg"
                    bgColor={theme.palette.common.white}
                    fgColor={theme.palette.common.black}
                  />
                </div>
                <TextField
                  id="two-factor-secret"
                  label={i18n.t("accountSecurity.secret")}
                  value={setup.secret}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
                <Alert severity="info">
                  {i18n.t("accountSecurity.secretHelp")}
                </Alert>
                <TextField
                  id="two-factor-code"
                  label={i18n.t("accountSecurity.code")}
                  value={code}
                  onChange={e =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputProps={{
                    inputMode: "numeric",
                    autoComplete: "one-time-code",
                    maxLength: 6
                  }}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  disabled={busy}
                  required
                />
                <div className={classes.row}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={busy || !/^\d{6}$/.test(code)}
                  >
                    {i18n.t("accountSecurity.confirm")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setSetup(null);
                      setCode("");
                      setError("");
                    }}
                  >
                    {i18n.t("accountSecurity.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Paper>
      <Dialog
        open={Boolean(action)}
        onClose={busy ? undefined : closeAction}
        fullWidth
        maxWidth="xs"
        aria-labelledby="security-action-title"
      >
        <form onSubmit={submitAction}>
          <DialogTitle id="security-action-title">
            {i18n.t(
              action === "disable"
                ? "accountSecurity.disable"
                : "accountSecurity.regenerate"
            )}
          </DialogTitle>
          <DialogContent>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography>
              {i18n.t(
                action === "disable"
                  ? "accountSecurity.disableHelp"
                  : "accountSecurity.regenerateHelp"
              )}
            </Typography>
            {action === "disable" && (
              <TextField
                id="security-password"
                label={i18n.t("accountSecurity.password")}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                fullWidth
                margin="normal"
                variant="outlined"
                disabled={busy}
                required
              />
            )}
            <TextField
              id="security-action-code"
              label={i18n.t(
                action === "disable"
                  ? "accountSecurity.secondFactor"
                  : "accountSecurity.code"
              )}
              value={code}
              onChange={e => setCode(e.target.value)}
              autoComplete="one-time-code"
              fullWidth
              margin="normal"
              variant="outlined"
              inputProps={{ maxLength: 16 }}
              disabled={busy}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAction} disabled={busy}>
              {i18n.t("accountSecurity.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              disabled={
                busy || !code.trim() || (action === "disable" && !password)
              }
            >
              {i18n.t("accountSecurity.confirm")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog
        open={recoveryCodes.length > 0}
        fullWidth
        maxWidth="sm"
        aria-labelledby="recovery-codes-title"
        disableEscapeKeyDown
      >
        <DialogTitle id="recovery-codes-title">
          {i18n.t("accountSecurity.recoveryTitle")}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            {i18n.t("accountSecurity.recoveryHelp")}
          </Alert>
          <div
            className={`${classes.codes} ${classes.block}`}
            aria-label={i18n.t("accountSecurity.recoveryTitle")}
          >
            {recoveryCodes.map(value => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={download}>
            {i18n.t("accountSecurity.download")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => setRecoveryCodes([])}
          >
            {i18n.t("accountSecurity.saved")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AccountSecurity;
