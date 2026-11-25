import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useTheme } from "@material-ui/core/styles";

import { useHistory, useLocation } from "react-router-dom";
import { format } from "date-fns";
import useSound from "use-sound";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles } from "@material-ui/core/styles";
import Badge from "@material-ui/core/Badge";
import ChatIcon from "@material-ui/icons/Chat";

import TicketListItem from "../TicketListItem";
import { i18n } from "../../translate/i18n";
import useTickets from "../../hooks/useTickets";
import alertSound from "../../assets/sound.mp3";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import Favicon from "react-favicon";
import { PRODUCT_ICON } from "../../helpers/productBrand";
import useSettings from "../../hooks/useSettings";
import { isWaitingForSector } from "../../helpers/generalTriage";

const defaultLogoFavicon = PRODUCT_ICON;
const noQueues = [];

const useStyles = makeStyles(theme => ({
  tabContainer: {
    overflowY: "auto",
    maxHeight: 350,
    ...theme.scrollbarStyles
  },
  noShadow: {
    boxShadow: "none !important"
  }
}));

const NotificationsPopOver = props => {
  const classes = useStyles();
  const theme = useTheme();

  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { id: userId, companyId, queues = noQueues } = user;
  const { pathname } = useLocation();
  const ticketUuid = pathname.startsWith("/tickets/")
    ? pathname.split("/")[2]
    : undefined;
  const ticketUuidRef = useRef(ticketUuid);
  const anchorEl = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [soundGroupNotifications, setSoundGroupNotifications] = useState(false);
  const [showTabGroups, setShowTabGroups] = useState(false);
  const queueIds = useMemo(
    () => new Set(queues.map(queue => queue.id)),
    [queues]
  );
  const canNotify = useCallback(
    ticket =>
      ticket &&
      ticket.companyId === companyId &&
      ticket.status !== "closed" &&
      // Zap Komunick (RF-033): the server only sends a conversation waiting
      // for a sector to an attendant of the general queue. An administrator
      // gets every ticket, so their bell keeps following their own sectors.
      (queueIds.has(ticket.queueId) ||
        (user?.profile !== "admin" && isWaitingForSector(ticket))) &&
      (ticket.userId === userId ||
        (ticket.userId == null && ticket.status === "pending")),
    [companyId, queueIds, userId, user?.profile]
  );

  const desktopNotifications = useRef(new Map());

  const { tickets, refetch: refetchTickets } = useTickets({
    notClosed: "true",
    withUnreadMessages: "true"
  });
  const [play] = useSound(alertSound, { volume: props.volume });
  const soundAlertRef = useRef();
  const { getSetting } = useSettings();

  const historyRef = useRef(history);

  const socketManager = useContext(SocketContext);

  const closeDesktopNotification = useCallback(ticketId => {
    const entry = desktopNotifications.current.get(ticketId);
    if (entry) {
      entry.notification.close();
      desktopNotifications.current.delete(ticketId);
    }
  }, []);

  const clearTicket = useCallback(
    ticketId => {
      setNotifications(prevState => prevState.filter(t => t.id !== ticketId));
      closeDesktopNotification(ticketId);
    },
    [closeDesktopNotification]
  );

  const handleNotifications = useCallback(data => {
    const { message, contact, ticket } = data;
    const body = message.body.startsWith('{"ticketzvCard"')
      ? "🪪"
      : message.body;
    try {
      const notification = new Notification(
        `${i18n.t("tickets.notification.message")} ${contact.name}`,
        {
          body: `${format(new Date(), "HH:mm")}\n${body}`,
          icon: contact.profilePicUrl,
          tag: String(ticket.id),
          renotify: true
        }
      );
      notification.onclick = event => {
        event.preventDefault();
        window.focus();
        historyRef.current.push(`/tickets/${ticket.uuid}`);
      };
      desktopNotifications.current.set(ticket.id, { notification, ticket });
    } catch (error) {
      console.error("Failed to push browser notification");
    }

    soundAlertRef.current();
  }, []);

  useEffect(() => {
    const entries = desktopNotifications.current;
    return () => {
      entries.forEach(({ notification }) => notification.close());
      entries.clear();
    };
  }, []);

  useEffect(() => {
    desktopNotifications.current.forEach(({ ticket }, ticketId) => {
      if (!canNotify(ticket)) closeDesktopNotification(ticketId);
    });
    refetchTickets();
  }, [canNotify, closeDesktopNotification, refetchTickets]);

  useEffect(() => {
    getSetting("soundGroupNotifications").then(soundGroupNotifications => {
      setSoundGroupNotifications(soundGroupNotifications === "enabled");
    });

    Promise.all([getSetting("CheckMsgIsGroup"), getSetting("groupsTab")]).then(
      ([ignoreGroups, groupsTab]) => {
        setShowTabGroups(
          ignoreGroups === "disabled" && groupsTab === "enabled"
        );
      }
    );
  }, [getSetting]);

  useEffect(() => {
    soundAlertRef.current = play;

    if (!("Notification" in window)) {
      console.log("This browser doesn't support notifications");
    } else {
      Notification.requestPermission();
    }
  }, [play]);

  useEffect(() => {
    setNotifications(tickets);
  }, [tickets]);

  useEffect(() => {
    ticketUuidRef.current = ticketUuid;
  }, [ticketUuid]);

  useEffect(() => {
    const socket = socketManager.GetSocket(companyId);
    let active = true;

    const onConnectNotificationsPopover = () => {
      if (active) socket.emit("joinTicketNotifications");
    };

    const upsertNotification = ticket => {
      setNotifications(prevState => [
        ticket,
        ...prevState.filter(previous => previous.id !== ticket.id)
      ]);
    };

    const onCompanyTicketNotificationsPopover = data => {
      if (data.action === "update" && data.ticket) {
        if (canNotify(data.ticket) && data.ticket.unreadMessages > 0) {
          upsertNotification(data.ticket);
        } else {
          clearTicket(data.ticket.id);
        }
      }

      if (["updateUnread", "delete", "removeFromList"].includes(data.action)) {
        clearTicket(data.ticketId);
        refetchTickets();
      }
    };

    const onCompanyAppMessageNotificationsPopover = data => {
      const { action, ticket, message } = data;
      if (action !== "create" || !message || message.read || !canNotify(ticket))
        return;

      upsertNotification(ticket);
      if (
        (ticketUuidRef.current === ticket.uuid &&
          ticket.uuid &&
          document.visibilityState === "visible") ||
        (ticket.isGroup && !soundGroupNotifications)
      )
        return;

      handleNotifications(data);
    };

    const onCompanyContactNotificationsPopover = data => {
      if (data.action !== "update") {
        return;
      }

      setNotifications(prevState =>
        prevState.map(ticket =>
          ticket.contactId === data.contact?.id
            ? { ...ticket, contact: { ...ticket.contact, ...data.contact } }
            : ticket
        )
      );
    };

    socketManager.onConnect(onConnectNotificationsPopover);
    socket.on(
      `company-${companyId}-ticket`,
      onCompanyTicketNotificationsPopover
    );
    socket.on(
      `company-${companyId}-appMessage`,
      onCompanyAppMessageNotificationsPopover
    );
    socket.on(
      `company-${companyId}-contact`,
      onCompanyContactNotificationsPopover
    );
    socket.on(`company-${companyId}-queue`, ({ action, queueId }) => {
      if (action !== "delete" || !queueIds.has(queueId)) return;

      setNotifications(previous =>
        previous.filter(ticket => ticket.queueId !== queueId)
      );
      desktopNotifications.current.forEach(({ ticket }, ticketId) => {
        if (ticket.queueId === queueId) closeDesktopNotification(ticketId);
      });
      refetchTickets();
    });
    socket.on("wsRefreshRequired", refreshRequired => {
      if (refreshRequired) {
        refetchTickets();
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [
    companyId,
    canNotify,
    clearTicket,
    closeDesktopNotification,
    handleNotifications,
    queueIds,
    soundGroupNotifications,
    socketManager,
    refetchTickets
  ]);

  const handleClick = () => {
    setIsOpen(prevState => !prevState);
  };

  const handleClickAway = () => {
    setIsOpen(false);
  };

  const NotificationTicket = ({ children }) => {
    return <div onClick={handleClickAway}>{children}</div>;
  };

  const visibleNotifications = notifications.filter(canNotify);

  const browserNotification = () => {
    const numbers = "⓿➊➋➌➍➎➏➐➑➒➓⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴";
    const count = visibleNotifications.length;
    if (count > 0) {
      if (count < 21) {
        document.title =
          numbers.substring(count, count + 1) +
          " - " +
          (theme.appName || "...");
      } else {
        document.title = "(" + count + ")" + (theme.appName || "...");
      }
    } else {
      document.title = theme.appName || "...";
    }
    return (
      <>
        <Favicon
          animated={true}
          url={
            theme?.appLogoFavicon ? theme.appLogoFavicon : defaultLogoFavicon
          }
          alertCount={count}
          iconSize={195}
        />
      </>
    );
  };

  return (
    <>
      {browserNotification()}
      <IconButton
        onClick={handleClick}
        ref={anchorEl}
        aria-label="Mostrar Notificações"
        variant="contained"
      >
        <ChatIcon style={{ color: theme.palette.primary.contrastText }} />
        {visibleNotifications.length > 0 ? (
          <Badge
            variant="dot"
            overlap="rectangular"
            color="secondary"
            style={{ marginTop: "-25px" }}
          ></Badge>
        ) : (
          ""
        )}
      </IconButton>
      <Popover
        disableScrollLock
        open={isOpen}
        anchorEl={anchorEl.current}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right"
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right"
        }}
        classes={{ paper: classes.popoverPaper }}
        onClose={handleClickAway}
      >
        <List dense className={classes.tabContainer}>
          {visibleNotifications.length === 0 ? (
            <ListItem>
              <ListItemText>{i18n.t("notifications.noTickets")}</ListItemText>
            </ListItem>
          ) : (
            visibleNotifications.map(ticket => (
              <NotificationTicket key={ticket.id}>
                <TicketListItem
                  ticket={ticket}
                  groupActionButtons={!showTabGroups}
                />
              </NotificationTicket>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};

export default NotificationsPopOver;
