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
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import pastRelativeDate from "../../helpers/pastRelativeDate";

// Zap Komunick: Kanban board by tags (docs/PRD.md, RF-004)

const OPEN_LANE = 0;

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
    display: "flex",
    flexDirection: "column",
    maxHeight: "100%",
    backgroundColor: theme.mode === "light" ? "#f4f5f7" : "#2b2b2b",
    borderTop: "4px solid",
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
    gap: theme.spacing(1),
    minHeight: 80
  },
  card: {
    padding: theme.spacing(1),
    cursor: "grab",
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`
    }
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

const KanbanCard = ({ ticket, lanes, currentLane, onMove, onOpen }) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Paper
      className={classes.card}
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
        style={{
          backgroundColor: generateColor(ticket.contact?.number),
          color: "white",
          width: 32,
          height: 32,
          fontSize: 14
        }}
      >
        {getInitials(ticket.contact?.name || "")}
      </Avatar>
      <div className={classes.cardBody} onClick={() => onOpen(ticket)}>
        <Typography variant="body2" className={classes.cardTitle}>
          {ticket.contact?.name}
        </Typography>
        <Typography
          variant="caption"
          color="textSecondary"
          component="div"
          className={classes.cardText}
        >
          {(ticket.lastMessage || "").split("\n")[0]}
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
          <Typography variant="caption" color="textSecondary">
            {ticket.user?.name || i18n.t("kanban.noAttendant")}
          </Typography>
          {ticket.updatedAt && (
            <Typography
              variant="caption"
              color="textSecondary"
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
