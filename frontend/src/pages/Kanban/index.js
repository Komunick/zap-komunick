import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import RefreshIcon from "@material-ui/icons/Refresh";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import { Alert } from "@material-ui/lab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { SocketContext } from "../../context/Socket/SocketContext";
import { getInitials } from "../../helpers/getInitials";
import { formatWhatsappContactName } from "../../helpers/formatWhatsappDisplay";
import pastRelativeDate from "../../helpers/pastRelativeDate";

// Zap Komunick: Kanban board by tags (docs/PRD.md, RF-004)

const OPEN_LANE = 0;

// Post-it notes: the lane's tag color washed out toward white (classic yellow
// for the "open" lane) and a small tilt that depends only on the ticket id
const NOTE_YELLOW = "#FFF1A8";

const noteColor = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return NOTE_YELLOW;
  const n = parseInt(m[1], 16);
  const mix = c => Math.round(c + (255 - c) * 0.8);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
};

const noteTilt = id => [-1.4, 0.9, -0.6, 1.3, -1][Math.abs(Number(id) || 0) % 5];

const useStyles = makeStyles(theme => ({
  board: {
    flex: 1,
    display: "flex",
    gap: theme.spacing(2),
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: theme.spacing(1),
    alignItems: "stretch"
  },
  lane: {
    flex: "0 0 290px",
    // without this a long unbreakable preview stretches the column (min-width: auto)
    minWidth: 0,
    width: 290,
    display: "flex",
    flexDirection: "column",
    maxHeight: "100%",
    // Direção B: no panel behind the cards, just the colored bar on top
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    borderTop: "4px solid",
    borderRadius: "4px 4px 0 0",
    transition: "box-shadow 120ms"
  },
  laneOver: {
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}`
  },
  laneHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1, 1.5)
  },
  laneTitle: {
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  laneBody: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(0, 1, 1),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    padding: theme.spacing(0, 1.5, 1.5),
    minHeight: 80
  },
  avatar: {
    backgroundColor: "rgba(35, 34, 27, 0.10)",
    color: "#23221b",
    width: 32,
    height: 32,
    fontSize: 12,
    fontWeight: 700
  },
  // the note keeps dark ink in both themes: it is paper, not a panel
  card: {
    position: "relative",
    marginTop: 10,
    padding: theme.spacing(2, 1.5, 1.75),
    border: "none",
    borderRadius: "2px 2px 18px 2px",
    color: "#23221b",
    cursor: "grab",
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    boxShadow: "0 1px 1px rgba(0, 0, 0, 0.12), 3px 6px 10px rgba(0, 0, 0, 0.16)",
    transform: "rotate(var(--tilt, 0deg))",
    transition: "transform 140ms ease, box-shadow 140ms ease",
    "&:hover, &:focus-visible": {
      transform: "rotate(0deg) translateY(-2px) scale(1.02)",
      boxShadow:
        "0 2px 2px rgba(0, 0, 0, 0.12), 6px 12px 18px rgba(0, 0, 0, 0.22)"
    },
    "&:active": {
      cursor: "grabbing"
    },
    // strip of tape holding the note
    "&::before": {
      content: '""',
      position: "absolute",
      top: -9,
      left: "50%",
      width: 54,
      height: 16,
      marginLeft: -27,
      backgroundColor: "rgba(255, 255, 255, 0.55)",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
      transform: "rotate(-2deg)"
    },
    // curled bottom right corner
    "&::after": {
      content: '""',
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 22,
      height: 22,
      borderRadius: "0 0 18px 0",
      background:
        "linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.10) 50%)"
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 3
    }
  },
  noteMeta: {
    color: "rgba(35, 34, 27, 0.66)"
  },
  noteIcon: {
    color: "rgba(35, 34, 27, 0.6)"
  },
  cardBody: {
    flex: 1,
    minWidth: 0
  },
  cardTitle: {
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  cardText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  cardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    alignItems: "center"
  },
  emptyLane: {
    textAlign: "center",
    padding: theme.spacing(2, 1)
  },
  centered: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }
}));

const laneId = lane => lane.tag?.id ?? OPEN_LANE;

const KanbanCard = ({ ticket, lanes, currentLane, color, onMove, onOpen }) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Paper
      className={classes.card}
      style={{
        backgroundColor: noteColor(color),
        "--tilt": `${noteTilt(ticket.id)}deg`
      }}
      draggable
      tabIndex={0}
      onDragStart={e => {
        e.dataTransfer.setData("text/plain", String(ticket.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onKeyDown={e => {
        if (e.key === "Enter") onOpen(ticket);
      }}
      aria-label={ticket.contact?.name}
    >
      <Avatar
        onClick={() => onOpen(ticket)}
        src={ticket.contact?.profilePicUrl}
        className={classes.avatar}
      >
        {getInitials(ticket.contact?.name || "")}
      </Avatar>
      <div className={classes.cardBody} onClick={() => onOpen(ticket)}>
        <Typography
          variant="body2"
          color="inherit"
          className={classes.cardTitle}
        >
          {formatWhatsappContactName(ticket.contact, ticket)}
        </Typography>
        <Typography
          variant="caption"
          component="div"
          className={`${classes.cardText} ${classes.noteMeta}`}
        >
          {(ticket.lastMessage || "")
            .replace(/[*_~`]/g, "")
            .replace(/\s*\n+\s*/g, " ")}
        </Typography>
        <div className={classes.cardMeta}>
          {ticket.queue && (
            <Chip
              size="small"
              label={ticket.queue.name}
              style={{
                backgroundColor: ticket.queue.color,
                color: "white",
                height: 18,
                fontSize: 11
              }}
            />
          )}
          <Typography variant="caption" className={classes.noteMeta}>
            {ticket.user?.name || i18n.t("kanban.noAttendant")}
          </Typography>
          {ticket.updatedAt && (
            <Typography
              variant="caption"
              className={classes.noteMeta}
              style={{ marginLeft: "auto" }}
            >
              {pastRelativeDate(parseISO(ticket.updatedAt))}
            </Typography>
          )}
        </div>
      </div>
      <Tooltip title={i18n.t("kanban.moveTo")}>
        <IconButton
          size="small"
          aria-label={i18n.t("kanban.moveTo")}
          aria-haspopup="true"
          className={classes.noteIcon}
          onClick={e => setAnchorEl(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onOpen(ticket);
          }}
        >
          {i18n.t("kanban.openTicket")}
        </MenuItem>
        {lanes
          .filter(lane => laneId(lane) !== currentLane)
          .map(lane => (
            <MenuItem
              key={laneId(lane)}
              onClick={() => {
                setAnchorEl(null);
                onMove(ticket.id, laneId(lane));
              }}
            >
              {i18n.t("kanban.moveTo")}:{" "}
              {lane.tag?.name || i18n.t("kanban.openLane")}
            </MenuItem>
          ))}
      </Menu>
    </Paper>
  );
};

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const socketManager = useContext(SocketContext);

  const [lanes, setLanes] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overLane, setOverLane] = useState(null);
  const refetchTimer = useRef(null);

  const fetchBoard = useCallback(async () => {
    try {
      const { data } = await api.get("/kanban");
      setLanes(data.lanes);
      setTruncated(data.truncated);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);

    const scheduleRefetch = () => {
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(fetchBoard, 1000);
    };

    const onConnect = () => {
      socket.emit("joinTickets", "open");
      socket.emit("joinTickets", "pending");
    };

    socketManager.onConnect(onConnect);
    socket.on(`company-${companyId}-ticket`, scheduleRefetch);
    socket.on(`company-${companyId}-appMessage`, scheduleRefetch);

    return () => {
      clearTimeout(refetchTimer.current);
      socket.emit("leaveTickets", "open");
      socket.emit("leaveTickets", "pending");
      socket.disconnect();
    };
  }, [socketManager, fetchBoard]);

  const handleMove = async (ticketId, targetLane) => {
    const previous = lanes;
    const ticket = lanes
      .flatMap(lane => lane.tickets)
      .find(item => item.id === ticketId);
    if (!ticket) return;

    // optimistic update, reverted on error
    setLanes(current =>
      current.map(lane => {
        const tickets = lane.tickets.filter(item => item.id !== ticketId);
        if (laneId(lane) === targetLane) {
          return { ...lane, tickets: [ticket, ...tickets] };
        }
        return { ...lane, tickets };
      })
    );

    try {
      await api.put(`/kanban/tickets/${ticketId}`, { tagId: targetLane });
    } catch (err) {
      setLanes(previous);
      toastError(err);
    }
  };

  const handleOpen = ticket => history.push(`/tickets/${ticket.uuid}`);

  const kanbanLanes = lanes.filter(lane => lane.tag);

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("kanban.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button component={RouterLink} to="/tags" variant="outlined">
            {i18n.t("kanban.manageTags")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setLoading(true);
              fetchBoard();
            }}
          >
            {i18n.t("kanban.refresh")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {!loading && kanbanLanes.length === 0 && (
        <Alert severity="info" style={{ marginBottom: 12 }}>
          {i18n.t("kanban.noKanbanTags")}
        </Alert>
      )}
      {truncated && (
        <Alert severity="warning" style={{ marginBottom: 12 }}>
          {i18n.t("kanban.truncated")}
        </Alert>
      )}

      {loading ? (
        <div className={classes.centered}>
          <CircularProgress />
        </div>
      ) : (
        <div className={classes.board}>
          {lanes.map(lane => {
            const id = laneId(lane);
            return (
              <Paper
                key={id}
                variant="outlined"
                className={`${classes.lane} ${
                  overLane === id ? classes.laneOver : ""
                }`}
                style={{ borderTopColor: lane.tag?.color || "#9e9e9e" }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overLane !== id) setOverLane(id);
                }}
                onDragLeave={() => setOverLane(null)}
                onDrop={e => {
                  e.preventDefault();
                  setOverLane(null);
                  const ticketId = Number(e.dataTransfer.getData("text/plain"));
                  const alreadyHere = lane.tickets.some(t => t.id === ticketId);
                  if (ticketId && !alreadyHere) handleMove(ticketId, id);
                }}
              >
                <div className={classes.laneHeader}>
                  <Typography className={classes.laneTitle}>
                    {lane.tag?.name || i18n.t("kanban.openLane")}
                  </Typography>
                  <Chip size="small" label={lane.tickets.length} />
                </div>
                <div className={classes.laneBody}>
                  {lane.tickets.length === 0 && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      className={classes.emptyLane}
                    >
                      {i18n.t("kanban.emptyLane")}
                    </Typography>
                  )}
                  {lane.tickets.map(ticket => (
                    <KanbanCard
                      key={ticket.id}
                      ticket={ticket}
                      lanes={lanes}
                      currentLane={id}
                      color={lane.tag?.color}
                      onMove={handleMove}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              </Paper>
            );
          })}
        </div>
      )}
    </MainContainer>
  );
};

export default Kanban;
