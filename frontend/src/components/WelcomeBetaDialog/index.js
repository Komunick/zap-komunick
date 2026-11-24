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
import HeadsetMicOutlinedIcon from "@material-ui/icons/HeadsetMicOutlined";
import { i18n } from "../../translate/i18n";

// Zap Komunick: welcome shown once to each user while the product is in beta
// (docs/PRD.md, RF-030). The answer is kept in this browser, per user; change
// the version in the key to show a new notice to everyone again.
// v2 (24/11/2026): the notice now leads with opening a support ticket.
export const welcomeBetaKey = userId => `superchat:welcomeBeta:v2:${userId}`;

const useStyles = makeStyles(theme => ({
  title: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1)
  },
  paragraph: { marginBottom: theme.spacing(1.5) },
  // The call to open a ticket is the part of the notice nobody should miss.
  highlight: {
    display: "flex",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
    borderRadius: 10,
    border: `2px solid ${theme.palette.primary.main}`,
    backgroundColor:
      theme.komunick?.selectedRow || theme.palette.action.selected
  },
  highlightIcon: {
    color: theme.palette.primary.main,
    fontSize: 32,
    flexShrink: 0,
    marginTop: 2
  },
  highlightTitle: { fontWeight: 700, marginBottom: theme.spacing(0.5) },
  steps: { margin: theme.spacing(0.5, 0, 0), paddingLeft: theme.spacing(2.5) },
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
    history.push("/support");
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
        <div className={classes.highlight} role="note">
          <HeadsetMicOutlinedIcon className={classes.highlightIcon} />
          <div>
            <Typography
              className={classes.highlightTitle}
              variant="subtitle1"
              component="h3"
            >
              {i18n.t("welcomeBeta.highlightTitle")}
            </Typography>
            <Typography variant="body2">
              {i18n.t("welcomeBeta.report")}
            </Typography>
            <ol className={classes.steps}>
              {["stepOpen", "stepDescribe", "stepFollow"].map(step => (
                <Typography key={step} component="li" variant="body2">
                  {i18n.t(`welcomeBeta.${step}`)}
                </Typography>
              ))}
            </ol>
          </div>
        </div>
        <Typography className={classes.paragraph}>
          {i18n.t("welcomeBeta.encourage")}
        </Typography>
        <Typography color="textSecondary">
          {i18n.t("welcomeBeta.thanks")}
        </Typography>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={dismiss}>{i18n.t("welcomeBeta.confirm")}</Button>
        <Button
          onClick={openReport}
          color="primary"
          variant="contained"
          startIcon={<HeadsetMicOutlinedIcon />}
          autoFocus
        >
          {i18n.t("welcomeBeta.openReport")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WelcomeBetaDialog;
