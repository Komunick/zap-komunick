import React, { useState, useEffect, useContext } from "react";

import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import GroupAddIcon from "@material-ui/icons/GroupAdd";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import TimerIcon from "@material-ui/icons/Timer";
import PeopleIcon from "@material-ui/icons/People";
import QueryBuilderIcon from "@material-ui/icons/QueryBuilder";
import ForumIcon from "@material-ui/icons/Forum";

import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import clsx from "clsx";

import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";

import { isEmpty } from "lodash";
import moment from "moment";
import { i18n } from "../../translate/i18n";
import useAuth from "../../hooks/useAuth.js";

import { SmallPie } from "./SmallPie";
import { TicketCountersChart } from "./TicketCountersChart";
import { getTimezoneOffset } from "../../helpers/getTimezoneOffset.js";

import api from "../../services/api.js";
import { SocketContext } from "../../context/Socket/SocketContext.js";
import { AuthContext } from "../../context/Auth/AuthContext";
import { formatTimeInterval } from "../../helpers/formatTimeInterval.js";

// Zap Komunick: friendlier dashboard. A greeting, the period as chips, what is
// happening now (team online, waiting, in service, each with its queues) and
// the numbers of the period, the chart and the team table.

const PERIODS = [0, 3, 7, 15, 30, 90];

const TONES = {
  green: { color: "#35B62E", soft: "rgba(53, 182, 46, 0.12)" },
  amber: { color: "#D98A00", soft: "rgba(217, 138, 0, 0.14)" },
  blue: { color: "#2F7FE0", soft: "rgba(47, 127, 224, 0.13)" },
  violet: { color: "#7A5AF8", soft: "rgba(122, 90, 248, 0.13)" },
  teal: { color: "#0E9F8E", soft: "rgba(14, 159, 142, 0.13)" }
};

const useStyles = makeStyles(theme => ({
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "24px 24px 40px",
    color: theme.palette.text.primary,
    [theme.breakpoints.down("xs")]: { padding: "16px 12px 32px" }
  },
  hero: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24
  },
  hello: { fontSize: 26, fontWeight: 800, lineHeight: 1.2 },
  helloSub: { marginTop: 4, fontSize: 15, color: theme.palette.text.secondary },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: 4,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper
  },
  chip: {
    height: 32,
    padding: "0 12px",
    border: 0,
    borderRadius: 10,
    background: "none",
    font: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    "&:hover": { color: theme.palette.text.primary },
    "&:focus-visible": { outline: `2px solid ${theme.komunick.accent}` }
  },
  chipOn: {
    color: "#FFFFFF",
    backgroundColor: theme.komunick.accent,
    "&:hover": { color: "#FFFFFF" }
  },
  dates: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-end",
    width: "100%",
    marginTop: -8,
    marginBottom: 20
  },
  date: {
    width: 220,
    [theme.breakpoints.down("xs")]: { width: "100%" }
  },
  sectionTitle: {
    margin: "8px 0 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  card: {
    height: "100%",
    padding: 20,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.komunick.shadow
  },
  cardHead: { display: "flex", alignItems: "center", gap: 10 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 11,
    flex: "none",
    "& svg": { fontSize: 20 }
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.text.secondary
  },
  liveBody: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12
  },
  bigValue: { fontSize: 34, fontWeight: 800, lineHeight: 1.1 },
  valueOf: { fontSize: 18, fontWeight: 600, color: theme.palette.text.secondary },
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 12,
    minHeight: 64
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: theme.palette.text.secondary
  },
  legendName: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  legendCount: { fontWeight: 700, color: theme.palette.text.primary },
  dot: { width: 8, height: 8, borderRadius: "50%", flex: "none" },
  calm: { fontSize: 13, color: theme.palette.text.secondary },
  kpiValue: { marginTop: 14, fontSize: 28, fontWeight: 800, lineHeight: 1.1 },
  chartCard: { height: 340, display: "flex", flexDirection: "column" },
  spacer: { height: 28 }
}));

const Badge = ({ tone, children }) => {
  const classes = useStyles();
  return (
    <span
      className={classes.badge}
      style={{ color: TONES[tone].color, backgroundColor: TONES[tone].soft }}
    >
      {children}
    </span>
  );
};

const LiveCard = ({
  tone,
  icon,
  title,
  value,
  of,
  chartData,
  calm,
  keepOrder
}) => {
  const classes = useStyles();
  const items = chartData.filter(item => item.value > 0);
  const sorted = keepOrder
    ? items
    : [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 3);
  const rest = items.length - top.length;

  return (
    <Grid item xs={12} md={4}>
      <Paper elevation={0} className={classes.card}>
        <div className={classes.cardHead}>
          <Badge tone={tone}>{icon}</Badge>
          <span className={classes.cardLabel}>{title}</span>
        </div>
        <div className={classes.liveBody}>
          <div className={classes.bigValue}>
            {value}
            {of !== undefined && (
              <span className={classes.valueOf}> / {of}</span>
            )}
          </div>
          {items.length > 0 && <SmallPie chartData={chartData} size={76} />}
        </div>
        <div className={classes.legend}>
          {top.length === 0 && <span className={classes.calm}>{calm}</span>}
          {top.map(item => (
            <div key={item.name} className={classes.legendRow}>
              <span
                className={classes.dot}
                style={{ backgroundColor: item.color }}
              />
              <span className={classes.legendName}>{item.name}</span>
              <span className={classes.legendCount}>{item.value}</span>
            </div>
          ))}
          {rest > 0 && (
            <span className={classes.calm}>
              {i18n.t("dashboardPage.more", { count: rest })}
            </span>
          )}
        </div>
      </Paper>
    </Grid>
  );
};

const KpiCard = ({ tone, icon, title, value }) => {
  const classes = useStyles();
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Paper elevation={0} className={classes.card}>
        <div className={classes.cardHead}>
          <Badge tone={tone}>{icon}</Badge>
          <span className={classes.cardLabel}>{title}</span>
        </div>
        <div className={classes.kpiValue}>{value}</div>
      </Paper>
    </Grid>
  );
};

const Dashboard = () => {
  const classes = useStyles();
  const [period, setPeriod] = useState(0);
  const [currentUser, setCurrentUser] = useState({});
  const [dateFrom, setDateFrom] = useState(
    moment("1", "D").format("YYYY-MM-DDTHH") + ":00"
  );
  const [dateTo, setDateTo] = useState(
    moment().format("YYYY-MM-DDTHH") + ":59"
  );
  const { getCurrentUserInfo } = useAuth();

  const [usersOnlineTotal, setUsersOnlineTotal] = useState(0);
  const [usersOfflineTotal, setUsersOfflineTotal] = useState(0);
  const [usersStatusChartData, setUsersStatusChartData] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingChartData, setPendingChartData] = useState([]);
  const [openedTotal, setOpenedTotal] = useState(0);
  const [openedChartData, setOpenedChartData] = useState([]);

  const [ticketsData, setTicketsData] = useState({});
  const [usersData, setUsersData] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const socketManager = useContext(SocketContext);
  const { user: authUser } = useContext(AuthContext);
  const companyId = localStorage.getItem("companyId");

  useEffect(() => {
    const socket = socketManager.GetSocket(companyId);

    socket.on("userOnlineChange", updateStatus);
    socket.on("counter", updateStatus);

    return () => {
      socket.off("userOnlineChange", updateStatus);
      socket.off("counter", updateStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, companyId]);

  useEffect(() => {
    getCurrentUserInfo().then(user => {
      if (user?.profile !== "admin") {
        window.location.href = "/tickets";
      }
      setCurrentUser(user);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function updateStatus() {
    api
      .get("/dashboard/status")
      .then(result => {
        const { data } = result;

        if (!data) return;

        let usersOnlineTotal = 0;
        let usersOfflineTotal = 0;
        data.usersStatusSummary.forEach(item => {
          if (item.online) {
            usersOnlineTotal++;
          } else {
            usersOfflineTotal++;
          }
        });

        setUsersStatusChartData([
          {
            name: i18n.t("dashboardPage.online"),
            value: usersOnlineTotal,
            color: TONES.green.color
          },
          {
            name: i18n.t("dashboardPage.offline"),
            value: usersOfflineTotal,
            color: "#B8C2BC"
          }
        ]);

        setUsersOnlineTotal(usersOnlineTotal);
        setUsersOfflineTotal(usersOfflineTotal);

        let pendingTotal = 0;
        let openedTotal = 0;
        const pendingChartData = [];
        const openedChartData = [];
        data.ticketsStatusSummary.forEach(item => {
          if (item.status === "pending") {
            pendingTotal += Number(item.count);
            pendingChartData.push({
              name: item.queue?.name || i18n.t("common.noqueue"),
              value: Number(item.count),
              color: item.queue?.color || "#888"
            });
            return;
          }
          if (item.status === "open") {
            openedTotal += Number(item.count);
            openedChartData.push({
              name: item.queue?.name || i18n.t("common.noqueue"),
              value: Number(item.count),
              color: item.queue?.color || "#888"
            });
          }
        });
        setPendingTotal(pendingTotal);
        setPendingChartData(pendingChartData);
        setOpenedTotal(openedTotal);
        setOpenedChartData(openedChartData);
      })
      .catch(() => {});
  }

  async function fetchData() {
    let params = { tz: getTimezoneOffset() };

    const days = Number(period);

    if (days) {
      params = {
        date_from: moment().subtract(days, "days").format("YYYY-MM-DD"),
        date_to: moment().format("YYYY-MM-DD")
      };
    }

    if (!days && !isEmpty(dateFrom) && moment(dateFrom).isValid()) {
      params = {
        ...params,
        date_from: moment(dateFrom).format("YYYY-MM-DD"),
        hour_from: moment(dateFrom).format("HH:mm:ss")
      };
    }

    if (!days && !isEmpty(dateTo) && moment(dateTo).isValid()) {
      params = {
        ...params,
        date_to: moment(dateTo).format("YYYY-MM-DD"),
        hour_to: moment(dateTo).format("HH:mm:ss")
      };
    }

    if (Object.keys(params).length === 0) {
      toast.error(i18n.t("dashboard.filter.invalid"));
      return;
    }

    api
      .get("/dashboard/tickets", { params })
      .then(result => {
        if (result?.data) {
          setTicketsData(result.data);
        }
      })
      .catch(() => {});

    setLoadingUsers(true);
    api
      .get("/dashboard/users", { params })
      .then(result => {
        if (result?.data) {
          setUsersData(result.data);
          setLoadingUsers(false);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    updateStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (currentUser?.profile !== "admin") {
    return <div></div>;
  }

  const firstName = (authUser?.name || currentUser.name || "")
    .trim()
    .split(" ")[0];
  const stats = ticketsData.ticketStatistics || {};

  return (
    <div className={classes.page}>
      <div className={classes.hero}>
        <div>
          <Typography component="h1" className={classes.hello}>
            {firstName
              ? i18n.t("dashboardPage.hello", { name: firstName })
              : i18n.t("dashboardPage.helloAnonymous")}
          </Typography>
          <Typography className={classes.helloSub}>
            {i18n.t("dashboardPage.subtitle")}
          </Typography>
        </div>
        <div
          className={classes.chips}
          role="group"
          aria-label={i18n.t("dashboard.filter.period")}
        >
          {PERIODS.map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              className={clsx(classes.chip, period === value && classes.chipOn)}
              onClick={() => setPeriod(value)}
            >
              {i18n.t(`dashboardPage.periods.p${value}`)}
            </button>
          ))}
        </div>
      </div>

      {!period && (
        <div className={classes.dates}>
          <TextField
            label={i18n.t("dashboard.date.start")}
            type="datetime-local"
            size="small"
            variant="outlined"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            onBlur={fetchData}
            className={classes.date}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={i18n.t("dashboard.date.end")}
            type="datetime-local"
            size="small"
            variant="outlined"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            onBlur={fetchData}
            className={classes.date}
            InputLabelProps={{ shrink: true }}
          />
        </div>
      )}

      <div className={classes.sectionTitle}>{i18n.t("dashboardPage.now")}</div>
      <Grid container spacing={2}>
        <LiveCard
          tone="green"
          icon={<PeopleIcon />}
          title={i18n.t("dashboardPage.teamOnline")}
          value={usersOnlineTotal}
          of={usersOnlineTotal + usersOfflineTotal}
          chartData={usersStatusChartData}
          calm={i18n.t("dashboardPage.nobodyOnline")}
          keepOrder
        />
        <LiveCard
          tone="amber"
          icon={<QueryBuilderIcon />}
          title={i18n.t("dashboardPage.waiting")}
          value={pendingTotal}
          chartData={pendingChartData}
          calm={i18n.t("dashboardPage.nobodyWaiting")}
        />
        <LiveCard
          tone="blue"
          icon={<ForumIcon />}
          title={i18n.t("dashboardPage.inService")}
          value={openedTotal}
          chartData={openedChartData}
          calm={i18n.t("dashboardPage.nobodyInService")}
        />
      </Grid>

      <div className={classes.spacer} />
      <div className={classes.sectionTitle}>
        {i18n.t("dashboardPage.inPeriod")}
      </div>
      <Grid container spacing={2}>
        <KpiCard
          tone="green"
          icon={<CheckCircleIcon />}
          title={i18n.t("dashboardPage.done")}
          value={stats.totalClosed || 0}
        />
        <KpiCard
          tone="violet"
          icon={<GroupAddIcon />}
          title={i18n.t("dashboard.newContacts")}
          value={stats.newContacts || 0}
        />
        <KpiCard
          tone="teal"
          icon={<TimerIcon />}
          title={i18n.t("dashboard.avgServiceTime")}
          value={formatTimeInterval(stats.avgServiceTime)}
        />
        <KpiCard
          tone="amber"
          icon={<HourglassEmptyIcon />}
          title={i18n.t("dashboard.avgWaitTime")}
          value={formatTimeInterval(stats.avgWaitTime)}
        />

        <Grid item xs={12}>
          <Paper elevation={0} className={clsx(classes.card, classes.chartCard)}>
            <TicketCountersChart ticketCounters={ticketsData.ticketCounters} />
          </Paper>
        </Grid>

        {usersData.userReport?.length ? (
          <Grid item xs={12}>
            <div className={classes.sectionTitle}>
              {i18n.t("dashboardPage.team")}
            </div>
            <TableAttendantsStatus
              attendants={usersData.userReport}
              loading={loadingUsers}
            />
          </Grid>
        ) : null}
      </Grid>
    </div>
  );
};

export default Dashboard;
