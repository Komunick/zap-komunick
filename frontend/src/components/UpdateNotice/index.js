import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  ClickAwayListener,
  Paper,
  Popper,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CachedIcon from "@material-ui/icons/Cached";
import { i18n } from "../../translate/i18n";

// Zap Komunick: "Atualizar", in the top bar, when a newer SuperChat than the
// one on screen was published (docs/PRD.md, RF-032).
//
// The person may be in the middle of a reply to a customer, so the notice
// NEVER takes the keyboard and never covers the conversation: it is a button
// in the bar, with no dialog, no backdrop and no focus of its own. The details
// open only on the person's click, in a Popper (not a modal). The page is only
// loaded again by the click on "Atualizar agora".
//
// The card is NOT sent to the end of the page (`disablePortal`): it comes right
// after the button, so Tab goes from "Atualizar" straight to its buttons, and
// Esc closes it.

const useStyles = makeStyles(theme => ({
  button: {
    flexShrink: 0,
    marginRight: theme.spacing(1),
    whiteSpace: "nowrap",
    fontWeight: 700,
    // on a phone the bar is crowded: only the icon stays
    [theme.breakpoints.down("xs")]: {
      minWidth: 0,
      padding: "4px 8px",
      "& .MuiButton-startIcon": { margin: 0 }
    }
  },
  label: { [theme.breakpoints.down("xs")]: { display: "none" } },
  // above the bar and the side menu, below any dialog and below the tour
  popper: { zIndex: theme.zIndex.drawer + 2 },
  card: {
    width: "min(340px, calc(100vw - 24px))",
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`
  },
  title: { fontWeight: 700, marginBottom: theme.spacing(0.5) },
  paragraph: { marginBottom: theme.spacing(1) },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5)
  }
}));

const reloadPage = () => window.location.reload();

// `available` comes from the layout (hooks/useAppUpdate), which also makes
// room for the button in the crowded bar of a phone.
const UpdateNotice = ({
  available = false,
  hidden = false,
  onReload = reloadPage
}) => {
  const classes = useStyles();
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const shown = available && !hidden;

  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown]);

  if (!shown) return null;

  const closeOnEscape = event => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    anchor.current?.focus();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      role="status"
      aria-live="polite"
      data-testid="update-notice"
      onKeyDown={closeOnEscape}
    >
      <Button
        ref={anchor}
        size="small"
        color="primary"
        variant="contained"
        className={classes.button}
        startIcon={<CachedIcon />}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={i18n.t("updateNotice.buttonLabel")}
        title={i18n.t("updateNotice.buttonLabel")}
        onClick={() => setOpen(current => !current)}
      >
        <span className={classes.label}>{i18n.t("updateNotice.button")}</span>
      </Button>
      <Popper
        open={open}
        anchorEl={anchor.current}
        placement="bottom-end"
        className={classes.popper}
        disablePortal
      >
        <ClickAwayListener
          onClickAway={event => {
            // the button itself toggles the card
            if (anchor.current?.contains(event.target)) return;
            setOpen(false);
          }}
        >
          <Paper elevation={8} className={classes.card}>
            <Typography className={classes.title} variant="subtitle1">
              {i18n.t("updateNotice.title")}
            </Typography>
            <Typography className={classes.paragraph} variant="body2">
              {i18n.t("updateNotice.text")}
            </Typography>
            <Typography className={classes.paragraph} variant="body2">
              {i18n.t("updateNotice.kept")}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("updateNotice.lost")}
            </Typography>
            <div className={classes.actions}>
              <Button size="small" onClick={() => setOpen(false)}>
                {i18n.t("updateNotice.later")}
              </Button>
              <Button
                size="small"
                color="primary"
                variant="contained"
                onClick={() => onReload()}
              >
                {i18n.t("updateNotice.now")}
              </Button>
            </div>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </span>
  );
};

export default UpdateNotice;
