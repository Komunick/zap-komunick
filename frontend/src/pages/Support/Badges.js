import React from "react";
import { Chip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { statusKey } from "../../helpers/supportTickets";

// Zap Komunick: status and priority labels of a support ticket (RF-030).
const useStyles = makeStyles(theme => {
  const tone = color => ({
    color,
    borderColor: color,
    backgroundColor: "transparent",
    fontWeight: 600
  });
  return {
    open: tone(theme.palette.info.main),
    in_progress: tone(theme.palette.primary.main),
    waiting: tone(theme.palette.warning.dark),
    waitingYou: {
      color: theme.palette.warning.contrastText,
      backgroundColor: theme.palette.warning.main,
      borderColor: theme.palette.warning.main,
      fontWeight: 700
    },
    done: tone(theme.palette.text.secondary),
    cancelled: tone(theme.palette.text.disabled),
    high: tone(theme.palette.warning.dark),
    critical: tone(theme.palette.error.main)
  };
});

export const StatusBadge = ({ ticket }) => {
  const classes = useStyles();
  const key = statusKey(ticket);
  return (
    <Chip
      size="small"
      variant="outlined"
      className={classes[key]}
      label={i18n.t(`support.status.${key}`)}
    />
  );
};

/** Low and medium are the ordinary case and stay out of the lists. */
export const PriorityBadge = ({ priority, always }) => {
  const classes = useStyles();
  if (!always && priority !== "high" && priority !== "critical") return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      className={classes[priority] || ""}
      label={i18n.t(`support.priority.${priority}`)}
    />
  );
};
