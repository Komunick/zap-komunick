import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
import { parseISO } from "date-fns";
import clsx from "clsx";

import { alpha, makeStyles } from "@material-ui/core/styles";
import { green, red } from "@material-ui/core/colors";
import ListItem from "@material-ui/core/ListItem";

import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";

import { i18n } from "../../translate/i18n";
import { formatWhatsappContactName } from "../../helpers/formatWhatsappDisplay";

import api from "../../services/api";

import WhatsMarked from "react-whatsmarked";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";
import TicketMessagesDialog from "../TicketMessagesDialog";
import CloseTicketModal from "../CloseTicketModal";
import DoneIcon from "@material-ui/icons/Done";
import ClearOutlinedIcon from "@material-ui/icons/ClearOutlined";
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import { BulkSelectionContext } from "../TicketsBulk";
import CheckIcon from "@material-ui/icons/Check";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";
import { TagPickerPopover } from "../TagPicker";
import pastRelativeDate from "../../helpers/pastRelativeDate";

import {
  formatMinutes,
  isSlaBreached,
  slaWaitingMinutes
} from "../../helpers/sla";

const useStyles = makeStyles(theme => ({
  ticket: {
    position: "relative",
    height: 98,
    paddingHorizontal: 10,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    // Zap Komunick: rounded rows instead of dividers
    margin: "2px 6px",
    width: "auto",
    borderRadius: 12,
    "&:hover": {
      backgroundColor: theme.komunick.hover
    },
    // Direção B: selected row gets a 2 px green outline (inset, no layout shift)
    "&.Mui-selected, &.Mui-selected:hover": {
      backgroundColor: theme.komunick.selectedRow,
      boxShadow: `inset 0 0 0 2px ${theme.komunick.accent}`
    }
  },

  pendingTicket: {
    cursor: "unset"
  },

  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  },

  noTicketsText: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: "14px",
    lineHeight: "1.4"
  },

  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px"
  },

  contactNameWrapper: {
    display: "grid",
    justifyContent: "space-between"
  },

  lastMessageTime: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    top: -23,
    fontSize: 12
  },

  closedBadge: {
    alignSelf: "center",
    justifySelf: "flex-end",
    marginRight: 32,
    marginLeft: "auto"
  },

  contactLastMessage: {},

  newMessagesCount: {
    alignSelf: "center",
    marginRight: 0,
    marginLeft: "auto",
    top: -10,
    right: 10
  },

  badgeStyle: {
    color: "white",
    backgroundColor: green[500],
    right: 0,
    top: 10
  },

  acceptButton: {
    position: "absolute",
    right: "108px"
  },

  ticketQueueColor: {
    flex: "none",
    width: "4px",
    height: "calc(100% - 28px)",
    position: "absolute",
    top: 14,
    left: 4,
    borderRadius: 4
  },

  ticketInfo: {
    position: "relative",
    top: 0
  },

  ticketInfo1: {
    position: "relative",
    top: 40,
    right: 0
  },
  Radiusdot: {
    "& .MuiBadge-badge": {
      borderRadius: 2,
      position: "inherit",
      height: 16,
      margin: 2,
      padding: 3,
      fontSize: 10
    },
    "& .MuiBadge-anchorOriginTopRightRectangle": {
      transform: "scale(1) translate(0%, -40%)"
    }
  },
  presence: {
    color: theme.mode === "light" ? "green" : "lightgreen",
    fontWeight: "bold"
  },
  chipUser: {
    "& .MuiBadge-badge": {
      backgroundColor: theme.komunick.subtle,
      color: theme.palette.text.secondary,
      border: `1px solid ${theme.palette.divider}`
    }
  },
  chipConnection: {
    "& .MuiBadge-badge": {
      backgroundColor: "transparent",
      color: theme.palette.text.secondary,
      border: `1px dashed ${theme.palette.divider}`
    }
  },
  pausedBadge: {
    backgroundColor: alpha(theme.palette.warning.main, 0.16),
    color: theme.palette.warning.dark,
    borderRadius: 7,
    padding: "0 5px",
    marginRight: 4,
    fontSize: 10,
    fontWeight: "bold"
  },
  slaBadge: {
    backgroundColor: red[700],
    color: "white",
    borderRadius: 7,
    padding: "0 5px",
    marginRight: 4,
    fontSize: 10,
    fontWeight: "bold"
  },
  // Zap Komunick: lean ticket row
  row: {
    height: "auto",
    minHeight: 78,
    alignItems: "flex-start",
    gap: 12,
    padding: "10px 12px",
    margin: "2px 6px",
    borderRadius: 12,
    "&:hover $rowActions, &:focus-within $rowActions": {
      opacity: 1
    }
  },
  rowAvatar: {
    width: 40,
    height: 40,
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF",
    marginTop: 2
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3
  },
  rowTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  rowName: {
    minWidth: 0,
    fontSize: 14,
    fontWeight: 700,
    color: theme.palette.text.primary
  },
  rowTime: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: theme.palette.text.secondary
  },
  rowMid: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  rowPreview: {
    minWidth: 0,
    fontSize: 13
  },
  rowUnread: {
    flex: "none",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "20px",
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: theme.palette.primary.main
  },
  rowBottom: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minHeight: 22,
    flexWrap: "nowrap",
    overflow: "hidden"
  },
  rowQueue: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary
  },
  rowTag: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 20,
    padding: "0 8px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 600,
    color: theme.palette.text.primary,
    backgroundColor: theme.komunick.tagBackground
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flex: "none"
  },
  rowUser: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    color: theme.palette.text.secondary
  },
  rowBot: {
    flex: "none",
    fontSize: 16,
    color: theme.palette.text.secondary
  },
  rowSpacer: {
    flex: 1
  },
  rowActions: {
    flex: "none",
    display: "inline-flex",
    opacity: 0,
    transition: "opacity 120ms",
    "& .MuiIconButton-root": {
      padding: 4,
      fontSize: 16,
      color: theme.palette.text.secondary
    }
  },
  rowCheck: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    marginTop: 2,
    borderRadius: "50%",
    border: `2px solid ${theme.komunick.borderStrong}`,
    fontSize: 22,
    color: "#FFFFFF"
  },
  rowChecked: {
    borderColor: theme.komunick.accent,
    backgroundColor: theme.komunick.accent
  },
  rowAccept: {
    padding: 4,
    fontSize: 16,
    color: theme.palette.primary.main,
    backgroundColor: theme.komunick.selectedRow
  }
}));

const TicketListItemCustom = ({
  ticket,
  setTabOpen,
  groupActionButtons,
  slaMinutes,
  closeReasonRequired
}) => {
  const classes = useStyles();

  const history = useHistory();
  const [ticketUser, setTicketUser] = useState(null);
  const [whatsAppName, setWhatsAppName] = useState(null);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const { ticketId } = useParams();
  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  // Zap Komunick: bulk selection (RF-011)
  const bulk = useContext(BulkSelectionContext);
  const selecting = !!bulk?.selecting;
  const checked = selecting && bulk.isSelected(ticket.id);
  const { user } = useContext(AuthContext);
  const { profile } = user;

  useEffect(() => {
    if (ticket.userId && ticket.user) {
      setTicketUser(ticket.user.name);
    }

    if (ticket.whatsappId && ticket.whatsapp) {
      setWhatsAppName(ticket.whatsapp.name);
    }

    return () => {
      isMounted.current = false;
    };
  }, [ticket]);

  const handleCloseTicket = async id => {
    // Zap Komunick: ask for the reason first (docs/PRD.md, RF-007)
    if (closeReasonRequired && !ticket.isGroup) {
      setCloseModalOpen(true);
      return;
    }
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        justClose: true,
        userId: user?.id
      });
    } catch (err) {
      toastError(err);
    }
    history.push(`/tickets/`);
  };

  const handleAcceptTicket = async id => {
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id
      });
    } catch (err) {
      toastError(err);
    }

    history.push(`/tickets/${ticket.uuid}`);
    setTabOpen("open");
  };

  const handleSelectTicket = ticket => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  // Zap Komunick: tag the ticket from the list (RF-019)
  const [tagAnchor, setTagAnchor] = useState(null);

  const showActions = groupActionButtons || !ticket.isGroup;
  const canAccept = ticket.status === "pending" && showActions;
  const canClose =
    ["open", "pending"].includes(ticket.status) &&
    (showActions || ticket.status === "open");
  const unread = Number(ticket.unreadMessages) || 0;
  const rowTags = (ticket.tags || []).slice(0, 2);
  const extraTags = Math.max(0, (ticket.tags || []).length - rowTags.length);
  const queueName = ticket.queue?.name || "Sem fila";

  // Zap Komunick: lean row. Name and time on top, last message and unread
  // count in the middle, queue, tags and attendant at the bottom. The extra
  // actions only show on hover; "accept" is always visible on pending tickets.
  return (
    <div key={`ticket-${ticket.id}`} className={classes.ticketContainer}>
      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      ></TicketMessagesDialog>
      <CloseTicketModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        ticket={ticket}
        justClose
        onClosed={() => history.push(`/tickets/`)}
      />
      {tagAnchor && (
        <TagPickerPopover
          anchorEl={tagAnchor}
          onClose={() => setTagAnchor(null)}
          ticket={ticket}
        />
      )}
      <ListItem
        dense
        button
        onClick={e => {
          if (selecting) {
            bulk.toggle(ticket.id);
            return;
          }
          if (
            (groupActionButtons || !ticket.isGroup) &&
            ticket.status === "pending"
          )
            return;
          handleSelectTicket(ticket);
        }}
        aria-pressed={selecting ? checked : undefined}
        // Zap Komunick: the route carries the uuid, so compare it too
        selected={
          selecting
            ? checked
            : !!ticketId &&
              (ticketId === ticket.uuid || +ticketId === ticket.id)
        }
        className={clsx(classes.ticket, classes.row, {
          [classes.pendingTicket]: ticket.status === "pending"
        })}
      >
        {selecting ? (
          <span
            className={clsx(classes.rowCheck, checked && classes.rowChecked)}
            aria-hidden="true"
          >
            {checked && <CheckIcon fontSize="inherit" />}
          </span>
        ) : (
          <Avatar
            className={classes.rowAvatar}
            style={{ backgroundColor: generateColor(ticket?.contact?.number) }}
            src={ticket?.contact?.profilePicUrl}
          >
            {getInitials(ticket?.contact?.name || "")}
          </Avatar>
        )}
        <div className={classes.rowBody}>
          <div className={classes.rowTop}>
            <Typography noWrap component="span" className={classes.rowName}>
              {formatWhatsappContactName(ticket.contact, ticket)}
            </Typography>
            <span className={classes.rowTime}>
              {ticket.status === "paused" && (
                <span className={classes.pausedBadge}>
                  {i18n.t("tickets.paused.badge")}
                </span>
              )}
              {isSlaBreached(ticket, slaMinutes) && (
                <Tooltip
                  title={i18n.t("sla.badgeTooltip", {
                    time: formatMinutes(slaWaitingMinutes(ticket))
                  })}
                >
                  <span className={classes.slaBadge}>
                    {i18n.t("sla.badge")}{" "}
                    {formatMinutes(slaWaitingMinutes(ticket))}
                  </span>
                </Tooltip>
              )}
              {ticket.lastMessage &&
                pastRelativeDate(parseISO(ticket.updatedAt))}
            </span>
          </div>
          <div className={classes.rowMid}>
            <Typography
              noWrap
              component="span"
              variant="body2"
              color="textSecondary"
              className={classes.rowPreview}
            >
              {["composing", "recording"].includes(ticket?.presence) ? (
                <span className={classes.presence}>
                  {i18n.t(`presence.${ticket.presence}`)}
                </span>
              ) : ticket.lastMessage?.includes("data:image/png;base64") ? (
                <span>Localização</span>
              ) : (
                <WhatsMarked oneline>
                  {ticket.lastMessage?.startsWith('{"ticketzvCard"')
                    ? "🪪"
                    : (ticket.lastMessage || "").split("\n")[0]}
                </WhatsMarked>
              )}
            </Typography>
            {unread > 0 && <span className={classes.rowUnread}>{unread}</span>}
          </div>
          <div className={classes.rowBottom}>
            <span className={classes.rowQueue}>
              <span
                className={classes.rowDot}
                style={{ backgroundColor: ticket.queue?.color || "#7C7C7C" }}
              />
              {queueName}
            </span>
            {rowTags.map(tag => (
              <span key={tag.id} className={classes.rowTag}>
                <span
                  className={classes.rowDot}
                  style={{ backgroundColor: tag.color || "#7C7C7C" }}
                />
                {tag.name}
              </span>
            ))}
            {extraTags > 0 && (
              <span className={classes.rowTag}>+{extraTags}</span>
            )}
            {ticketUser && ticket.status !== "pending" && (
              <span className={classes.rowUser}>{ticketUser}</span>
            )}
            {ticket.status === "closed" && (
              <span className={classes.rowTag}>{i18n.t("common.closed")}</span>
            )}
            {ticket.chatbot && (
              <Tooltip title="Chatbot">
                <AndroidIcon className={classes.rowBot} fontSize="inherit" />
              </Tooltip>
            )}
            <span className={classes.rowSpacer} />
            {canAccept && !selecting && (
              <Tooltip title="Aceitar Conversa">
                <IconButton
                  size="small"
                  className={classes.rowAccept}
                  onClick={e => {
                    e.stopPropagation();
                    handleAcceptTicket(ticket.id);
                  }}
                >
                  <DoneIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
            <span
              className={classes.rowActions}
              style={selecting ? { display: "none" } : undefined}
            >
              {profile === "admin" && showActions && (
                <Tooltip title="Espiar Conversa">
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      setOpenTicketMessageDialog(true);
                    }}
                  >
                    <VisibilityIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={i18n.t("tagPicker.action")}>
                <IconButton
                  size="small"
                  aria-label={i18n.t("tagPicker.action")}
                  onClick={e => {
                    e.stopPropagation();
                    setTagAnchor(e.currentTarget);
                  }}
                >
                  <LocalOfferOutlinedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              {canClose && (
                <Tooltip title="Fechar Conversa">
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      handleCloseTicket(ticket.id);
                    }}
                  >
                    <ClearOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </span>
          </div>
        </div>
      </ListItem>
    </div>
  );
};

export default TicketListItemCustom;
