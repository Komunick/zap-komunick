import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

// Zap Komunick: per user access hours (docs/PRD.md, RF-005)

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// form prefill only; the administrator reviews it before saving
const PREFILL = { weekdays: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" };

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(1)
  },
  days: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    margin: theme.spacing(1, 0)
  },
  times: {
    display: "flex",
    gap: theme.spacing(1)
  }
}));

const AccessHoursEditor = ({ value, onChange }) => {
  const classes = useStyles();
  const enabled = !!value;

  const toggleDay = day => {
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter(item => item !== day)
      : [...value.weekdays, day].sort();
    onChange({ ...value, weekdays });
  };

  return (
    <div className={classes.root}>
      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={enabled}
            onChange={e => onChange(e.target.checked ? PREFILL : null)}
          />
        }
        label={i18n.t("accessHours.restrict")}
      />
      <Typography variant="caption" color="textSecondary" component="div">
        {i18n.t("accessHours.helper")}
      </Typography>
      {enabled && (
        <>
          <div
            className={classes.days}
            role="group"
            aria-label={i18n.t("accessHours.weekdaysLabel")}
          >
            {WEEKDAYS.map(day => (
              <Chip
                key={day}
                label={i18n.t(`accessHours.weekdays.${day}`)}
                color={value.weekdays.includes(day) ? "primary" : "default"}
                onClick={() => toggleDay(day)}
                clickable
                aria-pressed={value.weekdays.includes(day)}
              />
            ))}
          </div>
          <div className={classes.times}>
            <TextField
              label={i18n.t("accessHours.start")}
              type="time"
              value={value.start}
              onChange={e => onChange({ ...value, start: e.target.value })}
              variant="outlined"
              margin="dense"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={i18n.t("accessHours.end")}
              type="time"
              value={value.end}
              onChange={e => onChange({ ...value, end: e.target.value })}
              variant="outlined"
              margin="dense"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </div>
          {value.weekdays.length === 0 && (
            <Typography variant="caption" color="error">
              {i18n.t("accessHours.noDays")}
            </Typography>
          )}
        </>
      )}
    </div>
  );
};

export default AccessHoursEditor;
