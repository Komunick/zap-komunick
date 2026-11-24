import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Button,
  Chip,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import useSupportSummary from "../../hooks/useSupportSummary";
import { splitTickets } from "../../helpers/supportTickets";
import NewTicketDialog from "./NewTicketDialog";
import TicketDetail from "./TicketDetail";
import TicketList from "./TicketList";

// Zap Komunick: support tickets (docs/PRD.md, RF-030). Every user opens and
// follows the own tickets here; the super administrators of the installation
// also get the queue with the tickets of every company.
const useStyles = makeStyles(theme => ({
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    width: "100%"
  },
  body: { flex: 1, minHeight: 0, display: "flex", gap: theme.spacing(2) },
  side: {
    width: 380,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden"
  },
  sideFull: { width: "100%" },
  filters: {
    padding: theme.spacing(1, 1.5),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  summary: { display: "flex", flexWrap: "wrap", gap: theme.spacing(0.5) },
  listBox: { flex: 1, minHeight: 0, overflowY: "auto" },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    textAlign: "center"
  }
}));

const Support = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { ticketId: routeTicketId } = useParams();
  const { user } = useContext(AuthContext);
  const isSuper = !!user?.super;
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const selectedId = /^[1-9]\d*$/.test(routeTicketId || "")
    ? Number(routeTicketId)
    : null;

  const [scope, setScope] = useState(isSuper ? "queue" : "mine");
  const [group, setGroup] = useState("active");
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [liveEvent, setLiveEvent] = useState(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const query = useRef({ scope, search });
  query.current = { scope, search };

  const fetchTickets = useCallback(async () => {
    const current = request.current + 1;
    request.current = current;
    try {
      const { data } = await api.get("/support/tickets", {
        params: {
          scope: query.current.scope,
          search: query.current.search.trim()
        }
      });
      // A slower answer of an older search must not replace a newer one.
      if (!mounted.current || request.current !== current) return;
      setTickets(data);
      setLoadError("");
    } catch {
      if (mounted.current && request.current === current)
        setLoadError(i18n.t("support.loadError"));
    }
  }, []);

  const { summary, refresh: refreshSummary } = useSupportSummary(event => {
    setLiveEvent({ ...event });
    fetchTickets();
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchTickets, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [scope, search, fetchTickets]);

  const select = id => history.push(id ? `/support/${id}` : "/support");

  const handleChanged = useCallback(() => {
    fetchTickets();
    refreshSummary();
  }, [fetchTickets, refreshSummary]);

  const groups = splitTickets(tickets);
  const visible = groups[group];
  const showList = wide || !selectedId;
  const showDetail = wide || !!selectedId;
  const queue = summary.queue;

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.headerRow}>
          <Title>{i18n.t("support.title")}</Title>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            {i18n.t("support.open")}
          </Button>
        </div>
      </MainHeader>
      <div className={classes.body}>
        {showList && (
          <Paper
            className={`${classes.side} ${wide ? "" : classes.sideFull}`}
            variant="outlined"
          >
            {isSuper && (
              <Tabs
                value={scope}
                onChange={(_, value) => setScope(value)}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab value="queue" label={i18n.t("support.tabs.queue")} />
                <Tab value="mine" label={i18n.t("support.tabs.mine")} />
              </Tabs>
            )}
            <div className={classes.filters}>
              {isSuper && scope === "queue" && queue && (
                <div className={classes.summary} data-testid="support-summary">
                  {["open", "unassigned", "inProgress", "waiting"].map(key => (
                    <Chip
                      key={key}
                      size="small"
                      variant="outlined"
                      label={`${i18n.t(`support.summary.${key}`)}: ${queue[key]}`}
                    />
                  ))}
                </div>
              )}
              <TextField
                id="support-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={i18n.t("support.search")}
                inputProps={{
                  maxLength: 100,
                  "aria-label": i18n.t("support.search")
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                variant="outlined"
                margin="dense"
                fullWidth
              />
              <Tabs
                value={group}
                onChange={(_, value) => setGroup(value)}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab
                  value="active"
                  label={`${i18n.t("support.groups.active")} (${groups.active.length})`}
                />
                <Tab
                  value="finished"
                  label={`${i18n.t("support.groups.finished")} (${groups.finished.length})`}
                />
              </Tabs>
            </div>
            <div className={classes.listBox}>
              {loadError ? (
                <Alert severity="error" role="alert">
                  {loadError}
                </Alert>
              ) : (
                <TicketList
                  tickets={visible}
                  selectedId={selectedId}
                  showRequester={scope === "queue"}
                  onSelect={select}
                  empty={
                    scope === "mine" && !tickets.length && !search
                      ? i18n.t("support.empty.mine")
                      : i18n.t("support.empty.list")
                  }
                />
              )}
            </div>
          </Paper>
        )}
        {showDetail && (
          <Paper className={classes.main} variant="outlined">
            {selectedId ? (
              <TicketDetail
                key={selectedId}
                ticketId={selectedId}
                isSuper={isSuper}
                liveEvent={liveEvent}
                onBack={wide ? undefined : () => select(null)}
                onChanged={handleChanged}
              />
            ) : (
              <Typography className={classes.placeholder} color="textSecondary">
                {i18n.t("support.empty.detail")}
              </Typography>
            )}
          </Paper>
        )}
      </div>
      <NewTicketDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={ticket => {
          setFormOpen(false);
          setScope("mine");
          setGroup("active");
          handleChanged();
          select(ticket.id);
        }}
      />
    </MainContainer>
  );
};

export default Support;
