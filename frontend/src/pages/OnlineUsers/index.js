import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { makeStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Switch from "@material-ui/core/Switch";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import RefreshIcon from "@material-ui/icons/Refresh";
import clsx from "clsx";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { SocketContext } from "../../context/Socket/SocketContext";
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import { formatMinutes } from "../../helpers/sla";

// Zap Komunick: who of the team is online and how busy (docs/PRD.md, RF-013).
// Refreshes when someone connects or leaves, when tickets move, and every
// minute for the times.

const REFRESH_MS = 60000;

const DOT = {
  online: "#35B62E",
  outsideHours: "#D98A00",
  offline: "#B8C2BC"
};

const useStyles = makeStyles(theme => ({
  page: {
    maxWidth: 1280,
    width: "100%",
    margin: "0 auto",
    padding: "24px 24px 40px",
    overflowY: "auto",
    color: theme.palette.text.primary,
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("xs")]: { padding: "16px 12px 32px" }
  },
  head: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20
  },
  title: { fontSize: 26, fontWeight: 800, lineHeight: 1.2 },
  subtitle: { marginTop: 4, fontSize: 15, color: theme.palette.text.secondary },
  tools: { display: "flex", alignItems: "center", gap: 8 },
  updated: { fontSize: 13, color: theme.palette.text.secondary },
  tile: {
    height: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.komunick.shadow
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.palette.text.secondary
  },
  tileValue: { marginTop: 6, fontSize: 28, fontWeight: 800 },
  sectionTitle: {
    margin: "28px 0 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  card: {
    height: "100%",
    padding: 18,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.komunick.shadow,
    display: "flex",
    flexDirection: "column",
    gap: 14
  },
  cardWarn: { borderColor: DOT.outsideHours },
  cardOff: { opacity: 0.72 },
  person: { display: "flex", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative", flex: "none" },
  avatar: { width: 44, height: 44, fontWeight: 700, color: "#FFFFFF" },
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: `2px solid ${theme.palette.background.paper}`
  },
  name: { fontSize: 16, fontWeight: 700 },
  status: { fontSize: 13, color: theme.palette.text.secondary },
  warn: {
    display: "inline-block",
    marginTop: 4,
    padding: "1px 8px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    color: "#8A5A00",
    backgroundColor: "rgba(217, 138, 0, 0.16)"
  },
  numbers: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8
  },
  number: {
    padding: "8px 10px",
    borderRadius: 10,
    backgroundColor: theme.komunick.subtle
  },
  numberValue: { fontSize: 20, fontWeight: 800 },
  numberLabel: { fontSize: 11, color: theme.palette.text.secondary },
  queues: { display: "flex", flexWrap: "wrap", gap: 6 },
  queue: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 24,
    padding: "0 9px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: theme.komunick.tagBackground
  },
  queueDot: { width: 8, height: 8, borderRadius: "50%" },
  muted: { fontSize: 12, color: theme.palette.text.secondary },
  empty: {
    padding: 32,
    textAlign: "center",
    color: theme.palette.text.secondary
  }
}));

const statusText = user => {
  if (user.situation !== "offline") {
    return user.minutesOnline
      ? i18n.t("onlineUsers.onlineFor", {
          time: formatMinutes(user.minutesOnline)
        })
      : i18n.t("onlineUsers.onlineNow");
  }
  if (user.minutesSinceSeen === null) return i18n.t("onlineUsers.neverSeen");
  if (user.minutesSinceSeen === 0) return i18n.t("onlineUsers.seenNow");
  return i18n.t("onlineUsers.seenAgo", {
    time: formatMinutes(user.minutesSinceSeen)
  });
};

const OnlineUsers = () => {
  const classes = useStyles();
  const socketManager = useContext(SocketContext);
  const [panel, setPanel] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [showOffline, setShowOffline] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/users/online");
      setPanel(data);
      setUpdatedAt(new Date());
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  // someone connected, left or a ticket moved: refresh, at most every 2 s
  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);
    const soon = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 2000);
    };
    socket.on("userOnlineChange", soon);
    socket.on("counter", soon);
    return () => {
      clearTimeout(timer.current);
      socket.off("userOnlineChange", soon);
      socket.off("counter", soon);
    };
  }, [socketManager, load]);

  const users = (panel?.users || []).filter(
    u => showOffline || u.situation !== "offline"
  );
  const summary = panel?.summary;

  const tiles = summary
    ? [
        { key: "online", value: summary.online },
        { key: "inService", value: summary.inService },
        { key: "idle", value: summary.idle },
        { key: "offline", value: summary.offline },
        ...(summary.outsideHours
          ? [{ key: "outsideHours", value: summary.outsideHours }]
          : [])
      ]
    : [];

  return (
    <div className={classes.page}>
      <div className={classes.head}>
        <div>
          <Typography component="h1" className={classes.title}>
            {i18n.t("onlineUsers.title")}
          </Typography>
          <Typography className={classes.subtitle}>
            {i18n.t("onlineUsers.subtitle")}
          </Typography>
        </div>
        <div className={classes.tools}>
          {updatedAt && (
            <span className={classes.updated}>
              {i18n.t("onlineUsers.updatedAt", {
                time: updatedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })
              })}
            </span>
          )}
          <Tooltip title={i18n.t("onlineUsers.refresh")}>
            <IconButton
              size="small"
              onClick={load}
              aria-label={i18n.t("onlineUsers.refresh")}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Grid container spacing={2}>
        {tiles.map(tile => (
          <Grid key={tile.key} item xs={6} sm={4} md={true}>
            <Paper elevation={0} className={classes.tile}>
              <div className={classes.tileLabel}>
                {i18n.t(`onlineUsers.summary.${tile.key}`)}
              </div>
              <div className={classes.tileValue}>{tile.value}</div>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <div
        className={classes.sectionTitle}
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>{i18n.t("onlineUsers.team")}</span>
        <FormControlLabel
          style={{ margin: 0 }}
          labelPlacement="start"
          label={
            <span style={{ fontSize: 13, textTransform: "none" }}>
              {i18n.t("onlineUsers.showOffline")}
            </span>
          }
          control={
            <Switch
              size="small"
              color="primary"
              checked={showOffline}
              onChange={e => setShowOffline(e.target.checked)}
            />
          }
        />
      </div>

      {panel && users.length === 0 && (
        <div className={classes.empty}>{i18n.t("onlineUsers.nobody")}</div>
      )}

      <Grid container spacing={2}>
        {users.map(user => (
          <Grid key={user.id} item xs={12} sm={6} md={4}>
            <Paper
              elevation={0}
              className={clsx(
                classes.card,
                user.situation === "outsideHours" && classes.cardWarn,
                user.situation === "offline" && classes.cardOff
              )}
              data-situation={user.situation}
            >
              <div className={classes.person}>
                <span className={classes.avatarWrap}>
                  <Avatar
                    className={classes.avatar}
                    style={{ backgroundColor: generateColor(user.name) }}
                  >
                    {getInitials(user.name)}
                  </Avatar>
                  <span
                    className={classes.dot}
                    style={{ backgroundColor: DOT[user.situation] }}
                    aria-label={i18n.t(
                      `onlineUsers.situation.${user.situation}`
                    )}
                  />
                </span>
                <div style={{ minWidth: 0 }}>
                  <Typography noWrap className={classes.name}>
                    {user.name}
                  </Typography>
                  <div className={classes.status}>{statusText(user)}</div>
                  {user.situation === "outsideHours" && (
                    <span className={classes.warn}>
                      {i18n.t("onlineUsers.situation.outsideHours")}
                    </span>
                  )}
                </div>
              </div>

              <div className={classes.numbers}>
                {[
                  ["openCount", user.openCount],
                  ["pausedCount", user.pausedCount],
                  ["closedToday", user.closedToday]
                ].map(([key, value]) => (
                  <div key={key} className={classes.number}>
                    <div className={classes.numberValue}>{value}</div>
                    <div className={classes.numberLabel}>
                      {i18n.t(`onlineUsers.numbers.${key}`)}
                    </div>
                  </div>
                ))}
              </div>

              {user.queues.length > 0 ? (
                <div className={classes.queues}>
                  {user.queues.map(queue => (
                    <span key={queue.id} className={classes.queue}>
                      <span
                        className={classes.queueDot}
                        style={{ backgroundColor: queue.color || "#7C7C7C" }}
                      />
                      {queue.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={classes.muted}>
                  {i18n.t("onlineUsers.noQueues")}
                </span>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </div>
  );
};

export default OnlineUsers;
