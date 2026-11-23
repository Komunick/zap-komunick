import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import clsx from "clsx";

import { IconButton, Paper, Tooltip, makeStyles } from "@material-ui/core";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
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
import SciPanel from "../SciPanel";
import AttachmentsPanel from "../AttachmentsPanel";
import { i18n } from "../../translate/i18n";
import { dragHasFiles, filesFromDrop } from "../../helpers/attachmentSelection";
import {
  readCustomerPanelCollapsed,
  writeCustomerPanelCollapsed
} from "../../helpers/customerPanelPreference";

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
  attachmentToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    padding: theme.spacing(0.5, 2),
    minWidth: 0
  },
  // Zap Komunick: shows or hides the contact panel beside the conversation.
  panelToggle: {
    alignSelf: "center",
    flex: "none",
    marginRight: theme.spacing(1),
    color: theme.palette.text.secondary
  },
  // Zap Komunick: the conversation and the composer accept dropped files.
  dropZone: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    position: "relative"
  },
  dropOverlay: {
    position: "absolute",
    inset: theme.spacing(1),
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.shape.borderRadius * 2,
    border: `2px dashed ${theme.palette.primary.main}`,
    backgroundColor:
      theme.komunick?.selectedRow || theme.palette.action.selected,
    color: theme.palette.text.primary,
    fontWeight: 600,
    pointerEvents: "none"
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
  const [panelCollapsed, setPanelCollapsed] = useState(() =>
    readCustomerPanelCollapsed(user?.id)
  );
  const [dropRequest, setDropRequest] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const { getSetting } = useSettings();

  const composerReady =
    !loading &&
    Number.isSafeInteger(Number(ticket.id)) &&
    Number(ticket.id) > 0 &&
    ticket.uuid === ticketId;

  useEffect(() => {
    setPanelCollapsed(readCustomerPanelCollapsed(user?.id));
  }, [user?.id]);

  // A drop belongs to the ticket on screen when it happened.
  useEffect(() => {
    setDropRequest(null);
  }, [ticketId]);

  const changePanelCollapsed = collapsed => {
    setPanelCollapsed(collapsed);
    writeCustomerPanelCollapsed(user?.id, collapsed);
  };

  const handleDragEnter = e => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragOver = e => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = e => {
    if (!dragHasFiles(e.dataTransfer)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = e => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!composerReady) return;
    setDropRequest({ id: Date.now(), files: filesFromDrop(e.dataTransfer) });
  };

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
    return () => {
      active = false;
      controller.abort();
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
          onClick={
            wide
              ? panelCollapsed
                ? () => changePanelCollapsed(false)
                : undefined
              : handleDrawerOpen
          }
        />
      );
    }
  };

  const attachmentContextReady =
    !loading &&
    Number.isSafeInteger(Number(ticket.id)) &&
    Number(ticket.id) > 0 &&
    ticket.uuid === ticketId;
  const attachmentContextKey = [
    ticketId,
    ticket.id,
    ticket.contactId,
    ticket.queueId,
    ticket.userId,
    ticket.status,
    user.id,
    user.companyId,
    user.profile,
    ...(user.queues || []).map(queue => queue.id).sort()
  ].join(":");

  const renderMessagesList = () => {
    return (
      <div
        className={classes.dropZone}
        data-testid="ticket-drop-zone"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
          markAsRead={true}
          attachmentContextReady={attachmentContextReady}
          attachmentContextKey={attachmentContextKey}
        ></MessagesList>
        {!loading &&
          Number.isSafeInteger(Number(ticket.id)) &&
          Number(ticket.id) > 0 &&
          ticket.uuid === ticketId && (
            <MessageInput
              ticket={ticket}
              showTabGroups
              dropRequest={dropRequest}
            />
          )}
        {dragging && (
          <div className={classes.dropOverlay} role="status">
            {i18n.t("messagesInput.dropFiles")}
          </div>
        )}
      </div>
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
          {wide && (
            <Tooltip
              title={i18n.t(
                panelCollapsed
                  ? "customerPanel.expand"
                  : "customerPanel.collapse"
              )}
            >
              <IconButton
                className={classes.panelToggle}
                aria-label={i18n.t(
                  panelCollapsed
                    ? "customerPanel.expand"
                    : "customerPanel.collapse"
                )}
                aria-expanded={!panelCollapsed}
                onClick={() => changePanelCollapsed(!panelCollapsed)}
              >
                {panelCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Tooltip>
          )}
        </TicketHeader>
        <Paper>
          {attachmentContextReady && (
            <div className={classes.attachmentToolbar}>
              <AttachmentsPanel
                ticketId={ticket.id}
                contextKey={attachmentContextKey}
              />
            </div>
          )}
          {!loading &&
            Number.isSafeInteger(Number(ticket.id)) &&
            Number(ticket.id) > 0 &&
            ticket.uuid === ticketId && (
              <>
                <AcessoriasPanel
                  key={`${ticket.id}:${ticket.contactId}:${ticket.queueId}:${ticket.userId}:${ticket.status}`}
                  ticketId={ticket.id}
                  contactId={ticket.contactId}
                  companyId={ticket.companyId}
                />
                <SciPanel
                  contextKey={`${ticket.id}:${ticket.contactId}:${ticket.queueId}:${ticket.userId}:${ticket.status}`}
                  ticketId={ticket.id}
                  contactId={ticket.contactId}
                  companyId={ticket.companyId}
                />
              </>
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
        !panelCollapsed && (
          <CustomerPanel ticket={ticket} contact={contact} loading={loading} />
        )
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
