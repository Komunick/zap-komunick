import React, { useState, useEffect, useContext } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import clsx from "clsx";

import { Paper, makeStyles } from "@material-ui/core";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import ContactDrawer from "../ContactDrawer";
import CustomerPanel from "../CustomerPanel";
import MessageInput from "../MessageInputCustom/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { SocketContext } from "../../context/Socket/SocketContext";
import useSettings from "../../hooks/useSettings";
import AcessoriasPanel from "../AcessoriasPanel";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden"
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen
    }),
    marginRight: 0
  },
  drawerShade: {
    display: "none",
    [theme.breakpoints.down(1400)]: {
      display: "block",
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backdropFilter: "blur(2px)",
      zIndex: 100
    }
  }
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  // Zap Komunick: on wide screens the customer panel is fixed beside the
  // conversation; below that the contact drawer keeps opening on click
  const wide = useMediaQuery("(min-width:1400px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [showTabGroups, setShowTabGroups] = useState(false);
  const [tagsMode, setTagsMode] = useState("ticket");
  const { getSetting } = useSettings();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    Promise.all([getSetting("CheckMsgIsGroup"), getSetting("groupsTab")]).then(
      ([ignoreGroups, groupsTab]) => {
        setShowTabGroups(
          ignoreGroups === "disabled" && groupsTab === "enabled"
        );
      }
    );

    getSetting("tagsMode", "ticket").then(tagsMode => {
      setTagsMode(tagsMode);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId, {
            signal: controller.signal
          });
          if (!active) return;
          const { queueId } = data;
          const { queues, profile } = user;

          const queueAllowed = queues.find(q => q.id === queueId);
          if (queueAllowed === undefined && profile !== "admin") {
            toast.error("Acesso não permitido");
            history.push("/tickets");
            return;
          }

          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          if (!active || controller.signal.aborted) return;
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(delayDebounceFn);
    };
  }, [ticketId, user, history]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");

    const socket = socketManager.GetSocket(companyId);
    let active = true;

    const onConnectTicket = () => {
      if (
        !active ||
        !Number.isSafeInteger(Number(ticket.id)) ||
        Number(ticket.id) <= 0 ||
        ticket.uuid !== ticketId
      )
        return;
      socket.emit("joinChatBox", `${ticket.id}`);
    };

    socketManager.onConnect(onConnectTicket);

    const onCompanyTicket = data => {
      if (data.action === "update" && data.ticket.id === ticket.id) {
        setTicket(data.ticket);
      }

      if (data.action === "delete" && data.ticketId === ticket.id) {
        history.push("/tickets");
      }
    };

    const onCompanyContact = data => {
      if (data.action === "update") {
        setContact(prevState => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    };

    socket.on(`company-${companyId}-ticket`, onCompanyTicket);
    socket.on(`company-${companyId}-contact`, onCompanyContact);

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [ticketId, ticket, history, socketManager]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const renderTicketInfo = () => {
    if (ticket.user !== undefined) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={wide ? undefined : handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
          markAsRead={true}
        ></MessagesList>
        {!loading &&
          Number.isSafeInteger(Number(ticket.id)) &&
          Number(ticket.id) > 0 &&
          ticket.uuid === ticketId && (
            <MessageInput ticket={ticket} showTabGroups />
          )}
      </>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen && !wide
        })}
      >
        <div
          className={clsx({
            [classes.drawerShade]: drawerOpen && !wide
          })}
          onClick={() => setDrawerOpen(false)}
        ></div>
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons ticket={ticket} showTabGroups={showTabGroups} />
        </TicketHeader>
        <Paper>
          {!loading &&
            Number.isSafeInteger(Number(ticket.id)) &&
            Number(ticket.id) > 0 &&
            ticket.uuid === ticketId && (
              <AcessoriasPanel
                key={`${ticket.id}:${ticket.contactId}:${ticket.queueId}:${ticket.userId}:${ticket.status}`}
                ticketId={ticket.id}
                contactId={ticket.contactId}
                companyId={ticket.companyId}
              />
            )}
          <TagsContainer
            ticket={["ticket", "both"].includes(tagsMode) && ticket}
            contact={tagsMode === "contact" && contact}
            queueId={ticket?.queueId}
            ticketId={ticket?.id}
          />
        </Paper>
        <ReplyMessageProvider>
          <EditMessageProvider>{renderMessagesList()}</EditMessageProvider>
        </ReplyMessageProvider>
      </Paper>
      {wide ? (
        <CustomerPanel ticket={ticket} contact={contact} loading={loading} />
      ) : (
        <ContactDrawer
          open={drawerOpen}
          handleDrawerClose={handleDrawerClose}
          contact={contact}
          loading={loading}
          ticket={ticket}
        />
      )}
    </div>
  );
};

export default Ticket;
