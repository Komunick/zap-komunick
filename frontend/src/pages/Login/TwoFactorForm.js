import React, { useEffect, useRef, useState } from "react";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  field: { marginTop: theme.spacing(2) },
  status: { marginTop: theme.spacing(2) },
  submit: { marginTop: theme.spacing(3), minHeight: 48, borderRadius: 12 },
  alternate: { marginTop: theme.spacing(1) },
  code: { fontSize: 22, letterSpacing: "0.15em" }
}));

// Zap Komunick: the challenge stays in this login screen's memory. A failed
// factor never creates an authenticated session (RF-016).
const TwoFactorForm = ({
  challenge,
  expiresAt,
  busy,
  onVerify,
  onCancel,
  onInvalidate
}) => {
  const classes = useStyles();
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const inputRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, recovery]);

  useEffect(() => {
    if (blocked || expired) return;
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        setExpired(true);
        setCode("");
        setError({ key: "expired" });
        onInvalidate();
      }
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, blocked, expired, onInvalidate]);

  const submit = async event => {
    event.preventDefault();
    if (busy || blocked || expired || !challenge) return;
    const normalized = recovery
      ? code.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : code;
    if (!(recovery ? /^[A-Z0-9]{8}$/ : /^\d{6}$/).test(normalized)) {
      setError({ key: recovery ? "recoveryFormat" : "codeFormat" });
      inputRef.current?.focus();
      return;
    }
    setError(null);
    const result = await onVerify({ challenge, code: normalized });
    if (!mounted.current || result.cancelled || result.authenticated) return;
    setCode("");
    if (result.error === "ERR_2FA_CHALLENGE_EXPIRED") {
      setExpired(true);
      setError({ key: "expired" });
      onInvalidate();
    } else if (result.error === "ERR_2FA_TOO_MANY_ATTEMPTS") {
      setBlocked(true);
      setError({
        key: "locked",
        minutes: Math.max(1, Math.ceil(result.retryAfter / 60))
      });
      onInvalidate();
    } else {
      const errors = {
        ERR_2FA_INVALID_CODE: "invalid",
        ERR_IP_NOT_ALLOWED: "ip",
        ERR_OUT_OF_ACCESS_HOURS: "hours"
      };
      setError({ key: errors[result.error] || "unavailable" });
    }
  };

  const unavailable = blocked || expired;
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <form noValidate onSubmit={submit} aria-busy={busy}>
      {error && (
        <Alert severity="error" className={classes.status}>
          {i18n.t(`login2fa.errors.${error.key}`, error)}
        </Alert>
      )}
      <TextField
        key={recovery ? "recovery" : "totp"}
        className={classes.field}
        fullWidth
        required
        variant="outlined"
        id="second-factor-code"
        name="secondFactorCode"
        label={i18n.t(recovery ? "login2fa.recoveryCode" : "login2fa.code")}
        helperText={i18n.t(
          recovery ? "login2fa.recoveryHelp" : "login2fa.codeHelp"
        )}
        value={code}
        onChange={event => {
          setCode(
            recovery
              ? event.target.value.toUpperCase()
              : event.target.value.replace(/\D/g, "").slice(0, 6)
          );
          if (!unavailable) setError(null);
        }}
        disabled={busy || unavailable}
        error={Boolean(error)}
        inputRef={inputRef}
        autoComplete={recovery ? "off" : "one-time-code"}
        inputProps={{
          className: classes.code,
          inputMode: recovery ? "text" : "numeric",
          maxLength: recovery ? 32 : 6,
          spellCheck: false,
          autoCapitalize: recovery ? "characters" : "off"
        }}
      />
      {!unavailable && (
        <Typography
          className={classes.status}
          variant="body2"
          color="textSecondary"
        >
          {i18n.t("login2fa.expiresIn", { time })}
        </Typography>
      )}
      <Button
        className={classes.submit}
        fullWidth
        variant="contained"
        color="primary"
        type="submit"
        disabled={busy || unavailable || !code.trim()}
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
      >
        {i18n.t(busy ? "login2fa.verifying" : "login2fa.verify")}
      </Button>
      <Button
        className={classes.alternate}
        fullWidth
        color="primary"
        disabled={busy || unavailable}
        onClick={() => {
          setRecovery(value => !value);
          setCode("");
          setError(null);
        }}
      >
        {i18n.t(
          recovery ? "login2fa.useAuthenticator" : "login2fa.useRecovery"
        )}
      </Button>
      <Button className={classes.alternate} fullWidth onClick={onCancel}>
        {i18n.t("login2fa.back")}
      </Button>
    </form>
  );
};

export default TwoFactorForm;
