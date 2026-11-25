import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useHistory, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Button, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { isOnTourRoute, tourStepContent } from "../../helpers/featureTour";
import { SPOTLIGHT_PADDING, placeBalloon } from "../../helpers/tourGeometry";
import useTargetRect from "./useTargetRect";

// Zap Komunick: the feature tour on screen (docs/PRD.md, RF-031), in the same
// shape as the tours of the Brazil TMS: the screen goes dark with a lit hole
// over what the step is about, a balloon tied to it explains how the feature
// works, a pill tells "Step n of N" and "Leave tour" is always at hand.
//
// The tour walks over the REAL screens: each step opens the page of the
// feature and points at where it lives in the menu. Nothing is clicked for the
// person and nothing is saved: while the tour is open the app behind it is
// inert (no click, no keyboard), and at the end the person is back where they
// were.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// Above the MUI dialogs (1300), snackbars (1400) and tooltips (1500).
const LAYER = 1600;
const CARD_BOTTOM = 20;

const useStyles = makeStyles(theme => ({
  "@keyframes tourRise": {
    from: { opacity: 0, transform: "translateY(12px)" },
    to: { opacity: 1, transform: "none" }
  },
  "@keyframes tourDrop": {
    from: { opacity: 0, transform: "translateY(-10px)" },
    to: { opacity: 1, transform: "none" }
  },
  "@keyframes tourEnter": {
    from: { opacity: 0, transform: "translateY(18px) scale(0.95)" },
    to: { opacity: 1, transform: "none" }
  },
  "@keyframes tourBreathe": {
    "0%, 100%": { opacity: 0.55, transform: "scale(1)" },
    "50%": { opacity: 1, transform: "scale(1.02)" }
  },
  "@keyframes tourDraw": { to: { strokeDashoffset: 0 } },
  root: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: LAYER,
    outline: "none",
    // Whoever asks for less motion gets the same tour, standing still.
    "@media (prefers-reduced-motion: reduce)": {
      "& *": {
        animation: "none !important",
        transition: "none !important"
      }
    }
  },
  // Takes every click meant for the app behind the tour.
  blocker: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(5, 8, 16, 0)",
    transition: "background-color .4s"
  },
  // No target on screen (phone, page inside "More"): the whole screen dims a
  // little and the explanation is a card at the bottom.
  blockerDim: { backgroundColor: "rgba(5, 8, 16, 0.5)" },
  spotlight: {
    position: "fixed",
    zIndex: 1,
    borderRadius: 12,
    pointerEvents: "none",
    boxShadow: "0 0 0 150vmax rgba(5, 8, 16, 0.64)"
  },
  ring: {
    position: "absolute",
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 15,
    border: `2px solid ${theme.palette.primary.main}`,
    boxShadow: `0 0 20px ${theme.palette.primary.main}`,
    animation: "$tourBreathe 2.4s ease-in-out infinite"
  },
  // The pill, the progress line and "Leave tour" stay above everything else
  // of the tour, the final screen included.
  progress: {
    position: "fixed",
    zIndex: 4,
    top: 0,
    left: 0,
    right: 0,
    height: 3
  },
  progressBar: {
    height: "100%",
    borderRadius: "0 3px 3px 0",
    backgroundColor: theme.palette.primary.main,
    boxShadow: `0 0 12px ${theme.palette.primary.main}`,
    transition: "width .7s"
  },
  pill: {
    position: "fixed",
    zIndex: 4,
    top: 10,
    left: 0,
    right: 0,
    margin: "0 auto",
    width: "fit-content",
    maxWidth: "calc(100vw - 250px)",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: "4px 14px",
    borderRadius: 999,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: 600,
    boxShadow: theme.shadows[6],
    animation: "$tourDrop .45s both"
  },
  pillText: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  pillWide: { [theme.breakpoints.down("xs")]: { display: "none" } },
  pillNarrow: { [theme.breakpoints.up("sm")]: { display: "none" } },
  dots: {
    display: "flex",
    gap: 4,
    [theme.breakpoints.down("sm")]: { display: "none" }
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: theme.palette.divider,
    transition: "all .5s"
  },
  dotDone: { backgroundColor: theme.palette.success?.main || "#12a06c" },
  dotNow: {
    backgroundColor: theme.palette.primary.main,
    transform: "scale(1.35)"
  },
  leave: {
    position: "fixed",
    zIndex: 4,
    top: 8,
    right: 16,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[6],
    "&:hover": { backgroundColor: theme.palette.background.paper }
  },
  // The step points at the very corner the button lives in (the user menu):
  // the button moves to the other corner instead of covering it.
  leaveOtherCorner: { right: "auto", left: 16 },
  balloon: {
    position: "fixed",
    zIndex: 3,
    width: "min(370px, calc(100vw - 24px))",
    maxHeight: "calc(100vh - 76px)",
    overflowY: "auto",
    padding: theme.spacing(2),
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[16]
  },
  balloonHidden: { opacity: 0, pointerEvents: "none" },
  arrow: {
    position: "absolute",
    width: 14,
    height: 14,
    transform: "rotate(45deg)",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`
  },
  arrowBelow: { borderBottom: 0, borderRight: 0 },
  arrowAbove: { borderTop: 0, borderLeft: 0 },
  arrowRight: { borderTop: 0, borderRight: 0 },
  arrowLeft: { borderBottom: 0, borderLeft: 0 },
  balloonBody: { animation: "$tourRise .4s both" },
  where: {
    display: "block",
    marginBottom: theme.spacing(0.5),
    color: theme.palette.primary.main,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  title: { fontWeight: 700, lineHeight: 1.25, marginBottom: theme.spacing(1) },
  points: {
    margin: theme.spacing(1, 0, 0),
    paddingLeft: theme.spacing(2.5),
    "& li": { marginBottom: theme.spacing(0.5) }
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5)
  },
  finalWrap: {
    position: "fixed",
    zIndex: 2,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    backgroundColor: "rgba(5, 8, 16, 0.64)"
  },
  finalCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
    borderRadius: 24,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    textAlign: "center",
    boxShadow: theme.shadows[24],
    animation: "$tourEnter .5s both"
  },
  finalBody: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(4, 4, 3)
  },
  check: { width: 72, height: 72 },
  checkCircle: {
    strokeDasharray: 167,
    strokeDashoffset: 167,
    animation: "$tourDraw .6s .1s ease-out forwards"
  },
  checkMark: {
    strokeDasharray: 40,
    strokeDashoffset: 40,
    animation: "$tourDraw .35s .6s ease-out forwards"
  },
  finalActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(2, 3),
    borderTop: `1px solid ${theme.palette.divider}`
  }
}));

const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight
});

// Only animates AFTER the first frame: the spotlight and the balloon are born
// on the target instead of flying in from the corner of the screen.
const useCanAnimate = active => {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (!active) {
      setCan(false);
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setCan(true));
    return () => window.cancelAnimationFrame(id);
  }, [active]);
  return can;
};

const Spotlight = ({ rect, classes }) => {
  const canAnimate = useCanAnimate(!!rect);
  const last = useRef(null);
  if (rect) last.current = rect;
  const shown = rect || last.current;
  if (!shown) return null;
  return (
    <div
      aria-hidden
      data-testid="tour-spotlight"
      className={classes.spotlight}
      style={{
        left: shown.left - SPOTLIGHT_PADDING,
        top: shown.top - SPOTLIGHT_PADDING,
        width: shown.width + SPOTLIGHT_PADDING * 2,
        height: shown.height + SPOTLIGHT_PADDING * 2,
        opacity: rect ? 1 : 0,
        transition: canAnimate
          ? `left .7s ${EASE}, top .7s ${EASE}, width .7s ${EASE}, height .7s ${EASE}, opacity .4s`
          : "none"
      }}
    >
      <span className={classes.ring} />
    </div>
  );
};

// The corner "Leave tour" takes: about 150 x 48 px at the top right.
const LEAVE_CORNER = { width: 170, height: 48 };

const coversLeaveCorner = rect =>
  !!rect &&
  rect.top < LEAVE_CORNER.height &&
  rect.left + rect.width > window.innerWidth - LEAVE_CORNER.width;

const focusablesOf = root =>
  Array.from(root.querySelectorAll("button:not([disabled])"));

const ARROW_CLASS = {
  below: "arrowBelow",
  above: "arrowAbove",
  right: "arrowRight",
  left: "arrowLeft"
};

const TourRunner = ({ steps, onClose }) => {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const total = steps.length;
  const finished = index >= total;
  const step = finished ? null : steps[index];
  const { rect, settled, side } = useTargetRect(step);
  const rootRef = useRef(null);
  const balloonRef = useRef(null);
  const [place, setPlace] = useState(null);
  const canAnimate = useCanAnimate(place !== null);
  // Where the person was when the tour began: that is where they go back to.
  const origin = useRef(`${location.pathname}${location.search}`);

  // THE APP BEHIND THE TOUR STANDS STILL: it does not scroll and does not take
  // focus. The tour lives in a portal outside the app root, so making the root
  // inert leaves only the tour reachable by Tab; the blocker takes the clicks.
  useEffect(() => {
    const appRoot = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;
    const wasInert = appRoot?.hasAttribute("inert");
    document.body.style.overflow = "hidden";
    if (appRoot && !wasInert) appRoot.setAttribute("inert", "");
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot && !wasInert) appRoot.removeAttribute("inert");
    };
  }, []);

  // Each step opens the page of its feature, so the real screen is the one
  // behind the explanation.
  useEffect(() => {
    if (step?.route && !isOnTourRoute(location.pathname, step.route)) {
      history.push(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Focus does not get lost when the step changes: a button that left the
  // screen ("Back" on the first step) would leave it on the body, and from
  // there Esc would not reach the tour.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = document.activeElement;
    if (!active || active === document.body || !root.contains(active)) {
      root.focus({ preventScroll: true });
    }
  }, [index]);

  useLayoutEffect(() => {
    const balloon = balloonRef.current;
    if (!balloon || finished || !settled) {
      setPlace(null);
      return;
    }
    const size = { width: balloon.offsetWidth, height: balloon.offsetHeight };
    const screen = viewport();
    if (rect) {
      setPlace(placeBalloon(rect, size, screen, side || step.side));
      return;
    }
    setPlace({
      side: "card",
      left: Math.max(12, (screen.width - size.width) / 2),
      top: Math.max(52, screen.height - size.height - CARD_BOTTOM),
      arrow: null
    });
  }, [rect, settled, side, finished, step, index]);

  const leave = useCallback(
    completed => {
      const back = origin.current;
      if (back !== `${history.location.pathname}${history.location.search}`) {
        history.push(back);
      }
      onClose(completed);
    },
    [history, onClose]
  );

  const next = () => setIndex(current => Math.min(current + 1, total));
  const back = () => setIndex(current => Math.max(current - 1, 0));

  // The keys of the tour: Esc leaves (on the final screen too: leaving never
  // counts as concluding), the arrows walk the steps, and Tab goes round the
  // buttons of the tour without ever reaching the app behind it or the
  // browser bar (from there the keys of the tour would stop working).
  const handleKey = event => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      leave(false);
      return;
    }
    if (event.key === "Tab") {
      const root = rootRef.current;
      const buttons = root ? focusablesOf(root) : [];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      const outside = !root.contains(active) || active === root;
      if (event.shiftKey ? outside || active === first : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (outside) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (finished) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      back();
    }
  };
  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;

  // THE KEYS ALSO WORK WITH THE FOCUS OUTSIDE THE TOUR. A click on the dark
  // area, or the focus coming back from the browser bar, leaves it on the
  // body, and from there the `onKeyDown` of the tour hears nothing. So the
  // document listens too, for the keys that were NOT born inside the tour
  // (those already went through `onKeyDown`).
  useEffect(() => {
    const onDocumentKey = event => {
      const from = event.target;
      if (from instanceof Node && rootRef.current?.contains(from)) return;
      handleKeyRef.current(event);
    };
    document.addEventListener("keydown", onDocumentKey);
    return () => document.removeEventListener("keydown", onDocumentKey);
  }, []);

  // The shortcut of the quick search (Ctrl K) is heard by the layout on the
  // window, which the inert app root does not silence. During the tour it is
  // stopped on the way down, so no search opens behind the explanation.
  useEffect(() => {
    const swallowSearchShortcut = event => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key?.toLowerCase() === "k"
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", swallowSearchShortcut, true);
    return () =>
      document.removeEventListener("keydown", swallowSearchShortcut, true);
  }, []);

  const content = step ? tourStepContent(step) : null;
  const progress = finished ? 100 : Math.round((index / total) * 100 + 6);
  const number = Math.min(index + 1, total);

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t("featureTour.title")}
      className={classes.root}
      onKeyDown={handleKey}
    >
      <div
        className={clsx(
          classes.blocker,
          !finished && settled && !rect && classes.blockerDim
        )}
      />
      {!finished && <Spotlight rect={rect} classes={classes} />}

      <div className={classes.progress}>
        <div
          className={classes.progressBar}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={classes.pill} data-testid="tour-pill">
        <span className={clsx(classes.pillText, classes.pillWide)}>
          {i18n.t("featureTour.stepOf", { n: number, total })}
        </span>
        {/* On a phone "Leave tour" takes the corner: the pill says it short. */}
        <span className={clsx(classes.pillText, classes.pillNarrow)}>
          {i18n.t("featureTour.stepShort", { n: number, total })}
        </span>
        <span className={classes.dots} aria-hidden>
          {steps.map((item, position) => (
            <i
              key={item.id}
              className={clsx(
                classes.dot,
                (position < index || finished) && classes.dotDone,
                position === index && !finished && classes.dotNow
              )}
            />
          ))}
        </span>
      </div>
      <Button
        size="small"
        variant="outlined"
        className={clsx(
          classes.leave,
          !finished && coversLeaveCorner(rect) && classes.leaveOtherCorner
        )}
        onClick={() => leave(false)}
      >
        {i18n.t("featureTour.leave")}
      </Button>

      {!finished && (
        <div
          ref={balloonRef}
          role="status"
          aria-live="polite"
          data-testid="tour-balloon"
          data-side={place?.side || ""}
          className={clsx(classes.balloon, !place && classes.balloonHidden)}
          style={{
            left: place?.left ?? 0,
            top: place?.top ?? 0,
            transition: canAnimate
              ? `left .7s ${EASE}, top .7s ${EASE}, opacity .35s`
              : "opacity .35s"
          }}
        >
          {place?.arrow && (
            <span
              aria-hidden
              className={clsx(classes.arrow, classes[ARROW_CLASS[place.side]])}
              style={{ left: place.arrow.left, top: place.arrow.top }}
            />
          )}
          <div key={step.id} className={classes.balloonBody}>
            {content.where && (
              <span className={classes.where}>{content.where}</span>
            )}
            <Typography className={classes.title} variant="subtitle1">
              {content.title}
            </Typography>
            <Typography variant="body2">{content.text}</Typography>
            {content.points.length > 0 && (
              <ul className={classes.points}>
                {content.points.map(point => (
                  <Typography key={point} component="li" variant="body2">
                    {point}
                  </Typography>
                ))}
              </ul>
            )}
          </div>
          <div className={classes.actions}>
            {index > 0 ? (
              <Button size="small" onClick={back}>
                {i18n.t("featureTour.back")}
              </Button>
            ) : (
              <span />
            )}
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={next}
            >
              {index === total - 1
                ? i18n.t("featureTour.finish")
                : i18n.t("featureTour.next")}
            </Button>
          </div>
        </div>
      )}

      {finished && (
        <div className={classes.finalWrap}>
          <div
            role="group"
            aria-labelledby="feature-tour-end"
            className={classes.finalCard}
          >
            <div className={classes.finalBody}>
              <svg viewBox="0 0 56 56" className={classes.check} aria-hidden>
                <circle
                  className={classes.checkCircle}
                  cx="28"
                  cy="28"
                  r="26.5"
                  fill="none"
                  stroke="#12a06c"
                  strokeWidth={4}
                />
                <path
                  className={classes.checkMark}
                  d="M16 29l8 8 16-17"
                  fill="none"
                  stroke="#12a06c"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Typography id="feature-tour-end" variant="h5" component="h2">
                {i18n.t("featureTour.endTitle")}
              </Typography>
              <Typography color="textSecondary">
                {i18n.t("featureTour.endText")}
              </Typography>
            </div>
            <div className={classes.finalActions}>
              <Button onClick={() => setIndex(0)}>
                {i18n.t("featureTour.repeat")}
              </Button>
              <Button
                color="primary"
                variant="contained"
                onClick={() => leave(true)}
              >
                {i18n.t("featureTour.conclude")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default TourRunner;
