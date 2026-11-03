import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import CircularProgress from "@material-ui/core/CircularProgress";
import RefreshIcon from "@material-ui/icons/Refresh";
import { Alert } from "@material-ui/lab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatMinutes } from "../../helpers/sla";

// Zap Komunick: SLA panel (docs/PRD.md, RF-002)

const REFRESH_MS = 60000;

const situationColors = {
  breached: "#c62828",
  old: "#ef6c00",
  ok: "#2e7d32"
};

const useStyles = makeStyles(theme => ({
  content: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: theme.spacing(2),
    ...theme.scrollbarStyles
  },
  card: {
    padding: theme.spacing(2),
    height: "100%",
    borderLeft: "4px solid transparent"
  },
  cardValue: {
    fontWeight: 700
  },
  section: {
    padding: theme.spacing(2),
    height: "100%"
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1)
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  clickableRow: {
    cursor: "pointer"
  },
  colorDot: {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginRight: 6
  },
  centered: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4)
  }
}));

const StatCard = ({ label, value, color }) => {
  const classes = useStyles();
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Paper
        variant="outlined"
        className={classes.card}
        style={{ borderLeftColor: color || "transparent" }}
      >
        <Typography variant="body2" color="textSecondary">
          {label}
        </Typography>
        <Typography
          variant="h4"
          className={classes.cardValue}
          style={color ? { color } : undefined}
        >
          {value}
        </Typography>
      </Paper>
    </Grid>
  );
};

const GroupTable = ({ title, rows, nameOf }) => {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.section}>
      <Typography className={classes.sectionTitle}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{i18n.t("sla.table.name")}</TableCell>
            <TableCell align="right">{i18n.t("sla.table.open")}</TableCell>
            <TableCell align="right">{i18n.t("sla.table.waiting")}</TableCell>
            <TableCell align="right">{i18n.t("sla.table.breached")}</TableCell>
            <TableCell align="right">{i18n.t("sla.table.old")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>{i18n.t("sla.empty")}</TableCell>
            </TableRow>
          )}
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{nameOf(row)}</TableCell>
              <TableCell align="right">{row.total}</TableCell>
              <TableCell align="right">{row.waiting}</TableCell>
              <TableCell
                align="right"
                style={
                  row.breached
                    ? { color: situationColors.breached, fontWeight: 600 }
                    : undefined
                }
              >
                {row.breached}
              </TableCell>
              <TableCell align="right">{row.old}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

const FILTERS = ["all", "breached", "old", "waiting"];

const Sla = () => {
  const classes = useStyles();
  const history = useHistory();
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchPanel = useCallback(async () => {
    try {
      const { data } = await api.get("/sla");
      setPanel(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPanel();
    const timer = setInterval(fetchPanel, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchPanel]);

  const tickets = useMemo(() => {
    if (!panel) return [];
    if (filter === "all") return panel.tickets;
    if (filter === "waiting") return panel.tickets.filter(t => t.waiting);
    return panel.tickets.filter(t => t.situation === filter);
  }, [panel, filter]);

  const queueName = row =>
    row.queueId === null ? (
      i18n.t("sla.noQueue")
    ) : (
      <>
        <span
          className={classes.colorDot}
          style={{ backgroundColor: row.color || "#9e9e9e" }}
        />
        {row.name}
      </>
    );

  const userName = row =>
    row.userId === null ? <b>{i18n.t("sla.noOwner")}</b> : row.name;

  const totals = panel?.totals;
  const config = panel?.config;

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("sla.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setLoading(true);
              fetchPanel();
            }}
          >
            {i18n.t("sla.refresh")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <div className={classes.content}>
        {loading && !panel ? (
          <div className={classes.centered}>
            <CircularProgress />
          </div>
        ) : (
          panel && (
            <>
              {config.slaMinutes > 0 ? (
                <Typography variant="body2" color="textSecondary" paragraph>
                  {i18n.t("sla.configSummary", {
                    sla: formatMinutes(config.slaMinutes),
                    hours: config.oldTicketHours
                  })}{" "}
                  · {i18n.t("sla.updatedAt")}{" "}
                  {new Date(panel.generatedAt).toLocaleTimeString()}
                </Typography>
              ) : (
                <Alert
                  severity="warning"
                  style={{ marginBottom: 16 }}
                  action={
                    <Button component={RouterLink} to="/settings" size="small">
                      {i18n.t("sla.goToSettings")}
                    </Button>
                  }
                >
                  {i18n.t("sla.disabled")}
                </Alert>
              )}

              <Grid container spacing={2} style={{ marginBottom: 8 }}>
                <StatCard
                  label={i18n.t("sla.cards.total")}
                  value={totals.total}
                />
                <StatCard
                  label={i18n.t("sla.cards.pending")}
                  value={totals.pending}
                />
                <StatCard
                  label={i18n.t("sla.cards.open")}
                  value={totals.open}
                />
                <StatCard
                  label={i18n.t("sla.cards.breached")}
                  value={totals.breached}
                  color={situationColors.breached}
                />
                <StatCard
                  label={i18n.t("sla.cards.old", {
                    hours: config.oldTicketHours
                  })}
                  value={totals.old}
                  color={situationColors.old}
                />
                <StatCard
                  label={i18n.t("sla.cards.waitingClients")}
                  value={totals.waitingClients}
                />
                <StatCard
                  label={i18n.t("sla.cards.groups")}
                  value={totals.groups}
                />
                <StatCard
                  label={i18n.t("sla.cards.waitingGroups")}
                  value={totals.waitingGroups}
                />
              </Grid>

              <Grid container spacing={2} style={{ marginBottom: 8 }}>
                <Grid item xs={12} md={6}>
                  <GroupTable
                    title={i18n.t("sla.byQueue")}
                    rows={panel.byQueue}
                    nameOf={queueName}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <GroupTable
                    title={i18n.t("sla.byUser")}
                    rows={panel.byUser}
                    nameOf={userName}
                  />
                </Grid>
              </Grid>

              <Paper variant="outlined" className={classes.section}>
                <Typography className={classes.sectionTitle}>
                  {i18n.t("sla.tickets")}
                </Typography>
                <div className={classes.filters}>
                  {FILTERS.map(key => (
                    <Chip
                      key={key}
                      label={i18n.t(`sla.filters.${key}`)}
                      color={filter === key ? "primary" : "default"}
                      onClick={() => setFilter(key)}
                      clickable
                    />
                  ))}
                </div>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{i18n.t("sla.table.client")}</TableCell>
                      <TableCell>{i18n.t("sla.table.ticket")}</TableCell>
                      <TableCell>{i18n.t("sla.table.queue")}</TableCell>
                      <TableCell>{i18n.t("sla.table.owner")}</TableCell>
                      <TableCell>{i18n.t("sla.table.status")}</TableCell>
                      <TableCell>{i18n.t("sla.table.waitingFor")}</TableCell>
                      <TableCell>{i18n.t("sla.table.situation")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7}>{i18n.t("sla.empty")}</TableCell>
                      </TableRow>
                    )}
                    {tickets.map(ticket => (
                      <TableRow
                        key={ticket.id}
                        hover
                        className={classes.clickableRow}
                        onClick={() => history.push(`/tickets/${ticket.uuid}`)}
                      >
                        <TableCell>
                          {ticket.contact?.name}
                          {ticket.isGroup && (
                            <Chip
                              size="small"
                              label={i18n.t("sla.group")}
                              style={{ marginLeft: 6, height: 18 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>#{ticket.id}</TableCell>
                        <TableCell>
                          {ticket.queue?.name || i18n.t("sla.noQueue")}
                        </TableCell>
                        <TableCell>
                          {ticket.user?.name || <b>{i18n.t("sla.noOwner")}</b>}
                        </TableCell>
                        <TableCell>
                          {i18n.t(`sla.status.${ticket.status}`)}
                        </TableCell>
                        <TableCell>
                          {ticket.waiting
                            ? formatMinutes(ticket.waitingMinutes)
                            : i18n.t("sla.answered")}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={i18n.t(`sla.situation.${ticket.situation}`, {
                              hours: config.oldTicketHours
                            })}
                            style={{
                              backgroundColor:
                                situationColors[ticket.situation],
                              color: "white"
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )
        )}
      </div>
    </MainContainer>
  );
};

export default Sla;
