import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ExploreOutlinedIcon from "@material-ui/icons/ExploreOutlined";
import { i18n } from "../../translate/i18n";
import {
  FEATURE_TOUR_EVENT,
  buildTourSteps,
  featureTourAnswered,
  rememberFeatureTour
} from "../../helpers/featureTour";
import TourRunner from "./TourRunner";

// Zap Komunick: who decides WHEN the feature tour shows up (RF-031), like the
// tour coordinator of the Brazil TMS. The tour is offered once to each user,
// after the beta notice was answered (never two notices on top of each other),
// and can be taken again at any time from the user menu ("Tour pelo sistema").
//
// The answer is kept in this browser, per user, like the beta notice. Taking
// the tour again never asks anything and never changes the stored answer.

const useStyles = makeStyles(theme => ({
  title: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5)
  },
  icon: { color: theme.palette.primary.main, fontSize: 34 },
  paragraph: { marginBottom: theme.spacing(1.5) },
  actions: { padding: theme.spacing(1, 3, 2) }
}));

const FeatureTour = ({ user, canOffer = true, onActiveChange }) => {
  const classes = useStyles();
  const userId = user?.id;
  const [mode, setMode] = useState(null); // null | "offer" | "running"
  const [firstTime, setFirstTime] = useState(false);

  const steps = useMemo(
    () =>
      buildTourSteps({
        isAdmin: user?.profile === "admin",
        isSuper: !!user?.super
      }),
    [user?.profile, user?.super]
  );

  // The offer: once per user, and only when no other notice is waiting.
  useEffect(() => {
    if (!userId || !canOffer || mode !== null) return;
    if (!featureTourAnswered(userId)) setMode("offer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, canOffer]);

  // "Tour pelo sistema" in the user menu (or anywhere else) asks for the tour.
  useEffect(() => {
    const open = () => {
      setFirstTime(false);
      setMode("running");
    };
    window.addEventListener(FEATURE_TOUR_EVENT, open);
    return () => window.removeEventListener(FEATURE_TOUR_EVENT, open);
  }, []);

  useEffect(() => {
    onActiveChange?.(mode === "running");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const start = () => {
    setFirstTime(true);
    setMode("running");
  };

  const later = () => {
    rememberFeatureTour(userId, "later");
    setMode(null);
  };

  const close = useCallback(
    completed => {
      if (firstTime) rememberFeatureTour(userId, completed ? "done" : "left");
      setMode(null);
    },
    [firstTime, userId]
  );

  if (mode === "running" && steps.length) {
    return <TourRunner steps={steps} onClose={close} />;
  }

  return (
    <Dialog
      open={mode === "offer"}
      onClose={later}
      maxWidth="xs"
      fullWidth
      aria-labelledby="feature-tour-offer"
    >
      <DialogTitle id="feature-tour-offer" disableTypography>
        <div className={classes.title}>
          <ExploreOutlinedIcon className={classes.icon} />
          <Typography variant="h6" component="h2">
            {i18n.t("featureTour.offerTitle")}
          </Typography>
        </div>
      </DialogTitle>
      <DialogContent>
        <Typography className={classes.paragraph}>
          {i18n.t("featureTour.offerText", { total: steps.length })}
        </Typography>
        <Typography color="textSecondary" variant="body2">
          {i18n.t("featureTour.offerLater")}
        </Typography>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={later}>{i18n.t("featureTour.notNow")}</Button>
        <Button onClick={start} color="primary" variant="contained" autoFocus>
          {i18n.t("featureTour.start")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeatureTour;
