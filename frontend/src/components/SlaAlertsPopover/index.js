import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TimerOutlined from "@material-ui/icons/TimerOutlined";
import { useHistory } from "react-router-dom";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  panel: {
    width: "min(360px, calc(100vw - 24px))",
    padding: theme.spacing(1, 0)
  },
  heading: { padding: theme.spacing(1, 2) },
  list: { maxHeight: "min(360px, 55vh)", overflowY: "auto" }
}));

export default function SlaAlertsPopover() {
  const classes = useStyles();
  const history = useHistory();
  const [anchor, setAnchor] = useState(null);
  const [data, setData] = useState({ alerts: [], unreadCount: 0 });
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async signal => {
    try {
      const { data: result } = await api.get("/sla/alerts", { signal });
      if (signal.aborted) return;
      setData(result);
      setFailed(false);
    } catch {
      if (!signal.aborted) setFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal);
    }, 60000);
    const onVisibility = () => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!anchor) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [anchor, refresh]);

  const openAlert = async alert => {
    if (opening) return;
    setOpening(true);
    try {
      if (!alert.readAt) {
        await api.put(`/sla/alerts/${alert.id}/read`);
        setData(previous => ({
          unreadCount: Math.max(0, previous.unreadCount - 1),
          alerts: previous.alerts.map(row =>
            row.id === alert.id
              ? { ...row, readAt: new Date().toISOString() }
              : row
          )
        }));
      }
      if (alert.ticketUuid) {
        setAnchor(null);
        history.push(`/tickets/${alert.ticketUuid}`);
      }
    } catch (error) {
      toastError(error);
    } finally {
      setOpening(false);
    }
  };

  const title = i18n.t("slaNotifications.title");
  return (
    <>
      <IconButton
        aria-label={title}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        color="inherit"
        onClick={event => setAnchor(event.currentTarget)}
      >
        <Badge badgeContent={data.unreadCount} color="secondary">
          <TimerOutlined />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: classes.panel, "aria-label": title }}
      >
        <Typography className={classes.heading} variant="subtitle1">
          {title}
        </Typography>
        {failed ? (
          <Typography className={classes.heading} color="error" role="alert">
            {i18n.t("slaNotifications.loadError")}
          </Typography>
        ) : data.alerts.length ? (
          <List disablePadding className={classes.list}>
            {data.alerts.map(alert => (
              <ListItem
                key={alert.id}
                button
                disabled={opening}
                selected={!alert.readAt}
                onClick={() => openAlert(alert)}
              >
                <ListItemText
                  primary={
                    alert.queueName
                      ? i18n.t("slaNotifications.waitingInQueue", {
                          queue: alert.queueName
                        })
                      : i18n.t("slaNotifications.waiting")
                  }
                  secondary={new Date(alert.createdAt).toLocaleString(
                    i18n.language
                  )}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography className={classes.heading} color="textSecondary">
            {i18n.t("slaNotifications.empty")}
          </Typography>
        )}
      </Popover>
    </>
  );
}
