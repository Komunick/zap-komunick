import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

// Zap Komunick: welcome shown once to each user while the product is in beta
// (docs/PRD.md, RF-030). The answer is kept in this browser, per user; change
// the version in the key to show a new notice to everyone again.
export const welcomeBetaKey = userId => `superchat:welcomeBeta:v1:${userId}`;

const useStyles = makeStyles(theme => ({
  title: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1)
  },
  paragraph: { marginBottom: theme.spacing(1.5) },
  actions: { padding: theme.spacing(1, 3, 2) }
}));

const alreadySeen = userId => {
  try {
    return localStorage.getItem(welcomeBetaKey(userId)) !== null;
  } catch {
    // Storage blocked: better to skip the notice than to show it every time.
    return true;
  }
};

const WelcomeBetaDialog = ({ userId }) => {
  const classes = useStyles();
  const history = useHistory();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!!userId && !alreadySeen(userId));
  }, [userId]);

  const dismiss = () => {
    try {
      localStorage.setItem(welcomeBetaKey(userId), new Date().toISOString());
    } catch {
      /* The notice comes back on the next visit; nothing else to do. */
    }
    setOpen(false);
  };

  const openReport = () => {
    dismiss();
    history.push("/error-report");
  };

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      maxWidth="sm"
      fullWidth
      aria-labelledby="welcome-beta-title"
    >
      <DialogTitle id="welcome-beta-title" disableTypography>
        <div className={classes.title}>
          <Typography variant="h6" component="h2">
            {i18n.t("welcomeBeta.title")}
          </Typography>
          <Chip
            size="small"
            color="primary"
            label={i18n.t("welcomeBeta.badge")}
          />
        </div>
      </DialogTitle>
      <DialogContent>
        <Typography className={classes.paragraph}>
          {i18n.t("welcomeBeta.intro")}
        </Typography>
        <Typography className={classes.paragraph}>
          {i18n.t("welcomeBeta.report")}
        </Typography>
        <Typography color="textSecondary">
          {i18n.t("welcomeBeta.thanks")}
        </Typography>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={openReport} color="primary">
          {i18n.t("welcomeBeta.openReport")}
        </Button>
        <Button onClick={dismiss} color="primary" variant="contained" autoFocus>
          {i18n.t("welcomeBeta.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WelcomeBetaDialog;
