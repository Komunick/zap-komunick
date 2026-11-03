import React, { useCallback, useEffect, useMemo, useState } from "react";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import GetAppIcon from "@material-ui/icons/GetApp";
import clsx from "clsx";
import { addDays, format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Zap Komunick: metrics panel (docs/PRD.md, RF-015). Period, queue and
// attendant filters; totals, tickets per day, per queue and per attendant,
// close reasons and the busiest hours. Exports what is on screen as CSV.

const PRESETS = [7, 30, 90, 0];
const GREEN = "#35B62E";
const BLUE = "#2F7FE0";

const useStyles = makeStyles(theme => ({
  page: {
    maxWidth: 1280,
    width: "100%",
    margin: "0 auto",
    padding: "24px 24px 40px",
    overflowY: "auto",
    color: theme.palette.text.primary,
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("xs")]: { padding: "16px 12px 32px" }
  },
  head: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16
  },
  title: { fontSize: 26, fontWeight: 800, lineHeight: 1.2 },
  subtitle: { marginTop: 4, fontSize: 15, color: theme.palette.text.secondary },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 20
  },
  chips: {
    display: "flex",
    gap: 4,
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
    cursor: "pointer"
  },
  chipOn: { color: "#FFFFFF", backgroundColor: theme.komunick.accent },
  select: { minWidth: 170 },
  date: { width: 160 },
  card: {
    height: "100%",
    padding: 18,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.komunick.shadow
  },
  label: { fontSize: 13, fontWeight: 600, color: theme.palette.text.secondary },
  value: { marginTop: 6, fontSize: 24, fontWeight: 800, whiteSpace: "nowrap" },
  hint: { marginTop: 2, fontSize: 12, color: theme.palette.text.secondary },
  section: { margin: "0 0 12px", fontSize: 16, fontWeight: 700 },
  chart: { height: 280 },
  table: {
    "& th, & td": { padding: "8px 10px", fontSize: 13 },
    "& td:not(:first-child), & th:not(:first-child)": { textAlign: "right" }
  },
  dot: {
    display: "inline-block",
    width: 8,
    height: 8,
    marginRight: 8,
    borderRadius: "50%"
  },
  reason: { marginBottom: 10 },
  reasonTop: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    marginBottom: 4
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.komunick.tagBackground,
    overflow: "hidden"
  },
  barFill: { height: "100%", backgroundColor: theme.komunick.accent },
  heat: {
    display: "grid",
    gridTemplateColumns: "44px repeat(24, minmax(14px, 1fr))",
    gap: 3,
    overflowX: "auto"
  },
  heatLabel: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    alignSelf: "center"
  },
  heatHour: {
    fontSize: 10,
    textAlign: "center",
    color: theme.palette.text.secondary
  },
  heatCell: { height: 22, borderRadius: 4 },
  empty: { padding: 16, fontSize: 13, color: theme.palette.text.secondary }
}));

const duration = secondsValue => {
  if (secondsValue === null || secondsValue === undefined) return "-";
  if (secondsValue < 60) return `${secondsValue} s`;
  const minutes = Math.round(secondsValue / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const restHours = hours % 24;
    const daysCount = Math.floor(hours / 24);
    return restHours ? `${daysCount} d ${restHours} h` : `${daysCount} d`;
  }
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
};

const pct = value =>
  value === null || value === undefined ? "-" : `${value}%`;

const today = () => format(new Date(), "yyyy-MM-dd");
const daysAgo = n => format(addDays(new Date(), -(n - 1)), "yyyy-MM-dd");

const csvCell = value => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const Metrics = () => {
  const classes = useStyles();
  const theme = useTheme();
  const [preset, setPreset] = useState(30);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [queueId, setQueueId] = useState("");
  const [userId, setUserId] = useState("");
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const t = (key, opts) => i18n.t(`metrics.${key}`, opts);

  useEffect(() => {
    Promise.all([api.get("/queue"), api.get("/users/list")])
      .then(([q, u]) => {
        setQueues(q.data);
        setUsers(u.data);
      })
      .catch(toastError);
  }, []);

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    setLoading(true);
    try {
      const { data: result } = await api.get("/metrics", {
        params: {
          from,
          to,
          ...(queueId ? { queueId } : {}),
          ...(userId ? { userId } : {})
        }
      });
      setData(result);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [from, to, queueId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = value => {
    setPreset(value);
    if (value) {
      setFrom(daysAgo(value));
      setTo(today());
    }
  };

  const heatMax = useMemo(
    () => Math.max(1, ...(data?.heatmap || []).flat()),
    [data]
  );

  const exportCsv = () => {
    if (!data) return;
    const lines = [];
    const add = row => lines.push(row.map(csvCell).join(";"));
    add([t("title"), `${data.period.from} - ${data.period.to}`]);
    add([]);
    add([t("kpi.created"), data.totals.created]);
    add([t("kpi.finished"), data.totals.finished]);
    add([t("kpi.avgWait"), duration(data.totals.avgWait)]);
    add([t("kpi.avgService"), duration(data.totals.avgService)]);
    add([t("kpi.sla"), pct(data.totals.slaPercent)]);
    add([t("kpi.newContacts"), data.totals.newContacts]);
    add([t("kpi.rating"), data.totals.rating ?? "-"]);
    add([]);
    add([t("byDay"), t("cols.created"), t("cols.finished")]);
    data.byDay.forEach(d => add([d.day, d.created, d.finished]));
    add([]);
    add([
      t("byQueue"),
      t("cols.created"),
      t("cols.finished"),
      t("cols.avgWait"),
      t("cols.avgService"),
      t("cols.sla")
    ]);
    data.byQueue.forEach(q =>
      add([
        q.name || t("noQueue"),
        q.created,
        q.finished,
        duration(q.avgWait),
        duration(q.avgService),
        pct(q.slaPercent)
      ])
    );
    add([]);
    add([
      t("byUser"),
      t("cols.finished"),
      t("cols.created"),
      t("cols.avgWait"),
      t("cols.avgService"),
      t("cols.sla"),
      t("cols.rating")
    ]);
    data.byUser.forEach(u =>
      add([
        u.name || t("noUser"),
        u.finished,
        u.created,
        duration(u.avgWait),
        duration(u.avgService),
        pct(u.slaPercent),
        u.rating ?? "-"
      ])
    );
    add([]);
    add([t("closeReasons"), t("cols.count"), "%"]);
    data.closeReasons.forEach(r =>
      add([r.name || t("noReason"), r.count, pct(r.percent)])
    );
    const blob = new Blob([`﻿${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `metricas-${data.period.from}-a-${data.period.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const totals = data?.totals;
  const kpis = totals
    ? [
        { key: "created", value: totals.created },
        { key: "finished", value: totals.finished },
        { key: "avgWait", value: duration(totals.avgWait) },
        { key: "avgService", value: duration(totals.avgService) },
        {
          key: "sla",
          value: pct(totals.slaPercent),
          hint: data.slaMinutes
            ? t("kpi.slaHint", { minutes: data.slaMinutes })
            : t("kpi.slaOff")
        },
        { key: "newContacts", value: totals.newContacts },
        {
          key: "rating",
          value: totals.rating ?? "-",
          hint: t("kpi.ratingHint", { count: totals.ratings })
        }
      ]
    : [];

  const weekdays = t("weekdays").split(",");

  return (
    <div className={classes.page}>
      <div className={classes.head}>
        <div>
          <Typography component="h1" className={classes.title}>
            {t("title")}
          </Typography>
          <Typography className={classes.subtitle}>{t("subtitle")}</Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<GetAppIcon />}
          disabled={!data}
          onClick={exportCsv}
        >
          {t("export")}
        </Button>
      </div>

      <div className={classes.filters}>
        <div className={classes.chips} role="group" aria-label={t("period")}>
          {PRESETS.map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              className={clsx(classes.chip, preset === value && classes.chipOn)}
              onClick={() => choosePreset(value)}
            >
              {value ? t("days", { count: value }) : t("custom")}
            </button>
          ))}
        </div>
        {preset === 0 && (
          <>
            <TextField
              type="date"
              size="small"
              variant="outlined"
              label={t("from")}
              className={classes.date}
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
            <TextField
              type="date"
              size="small"
              variant="outlined"
              label={t("to")}
              className={classes.date}
              InputLabelProps={{ shrink: true }}
              value={to}
              error={from > to}
              onChange={e => setTo(e.target.value)}
            />
          </>
        )}
        <TextField
          select
          size="small"
          variant="outlined"
          label={t("queue")}
          className={classes.select}
          value={queueId}
          onChange={e => setQueueId(e.target.value)}
        >
          <MenuItem value="">{t("allQueues")}</MenuItem>
          {queues.map(q => (
            <MenuItem key={q.id} value={q.id}>
              {q.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label={t("user")}
          className={classes.select}
          value={userId}
          onChange={e => setUserId(e.target.value)}
        >
          <MenuItem value="">{t("allUsers")}</MenuItem>
          {users.map(u => (
            <MenuItem key={u.id} value={u.id}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>
        {loading && <span className={classes.hint}>{t("loading")}</span>}
      </div>

      <Grid container spacing={2}>
        {kpis.map(kpi => (
          <Grid key={kpi.key} item xs={6} sm={4} md={true}>
            <Paper elevation={0} className={classes.card} data-kpi={kpi.key}>
              <div className={classes.label}>{t(`kpi.${kpi.key}`)}</div>
              <div className={classes.value}>{kpi.value}</div>
              {kpi.hint && <div className={classes.hint}>{kpi.hint}</div>}
            </Paper>
          </Grid>
        ))}

        {data && (
          <>
            <Grid item xs={12}>
              <Paper elevation={0} className={classes.card}>
                <div className={classes.section}>{t("byDay")}</div>
                <div className={classes.chart}>
                  <ResponsiveContainer>
                    <AreaChart
                      data={data.byDay}
                      margin={{ left: -16, right: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="mCreated"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={BLUE}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="100%"
                            stopColor={BLUE}
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="mFinished"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={GREEN}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={GREEN}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="4"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="day"
                        tickFormatter={d => format(parseISO(d), "dd/MM")}
                        stroke={theme.palette.text.secondary}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke={theme.palette.text.secondary}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        labelFormatter={d => format(parseISO(d), "dd/MM/yyyy")}
                      />
                      <Area
                        type="monotone"
                        name={t("cols.created")}
                        dataKey="created"
                        stroke={BLUE}
                        strokeWidth={2}
                        fill="url(#mCreated)"
                      />
                      <Area
                        type="monotone"
                        name={t("cols.finished")}
                        dataKey="finished"
                        stroke={GREEN}
                        strokeWidth={2}
                        fill="url(#mFinished)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper elevation={0} className={classes.card}>
                <div className={classes.section}>{t("byQueue")}</div>
                {data.byQueue.length === 0 ? (
                  <div className={classes.empty}>{t("nothing")}</div>
                ) : (
                  <Table size="small" className={classes.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("cols.queue")}</TableCell>
                        <TableCell>{t("cols.created")}</TableCell>
                        <TableCell>{t("cols.finished")}</TableCell>
                        <TableCell>{t("cols.avgWait")}</TableCell>
                        <TableCell>{t("cols.avgService")}</TableCell>
                        <TableCell>{t("cols.sla")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.byQueue.map(q => (
                        <TableRow key={q.queueId || "none"}>
                          <TableCell>
                            <span
                              className={classes.dot}
                              style={{ backgroundColor: q.color || "#B8C2BC" }}
                            />
                            {q.name || t("noQueue")}
                          </TableCell>
                          <TableCell>{q.created}</TableCell>
                          <TableCell>{q.finished}</TableCell>
                          <TableCell>{duration(q.avgWait)}</TableCell>
                          <TableCell>{duration(q.avgService)}</TableCell>
                          <TableCell>{pct(q.slaPercent)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper elevation={0} className={classes.card}>
                <div className={classes.section}>{t("closeReasons")}</div>
                {data.closeReasons.length === 0 && (
                  <div className={classes.empty}>{t("nothing")}</div>
                )}
                {data.closeReasons.map(r => (
                  <div
                    key={r.closeReasonId || "none"}
                    className={classes.reason}
                  >
                    <div className={classes.reasonTop}>
                      <span>{r.name || t("noReason")}</span>
                      <strong>
                        {r.count} · {pct(r.percent)}
                      </strong>
                    </div>
                    <div className={classes.bar}>
                      <div
                        className={classes.barFill}
                        style={{ width: `${r.percent || 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper elevation={0} className={classes.card}>
                <div className={classes.section}>{t("byUser")}</div>
                {data.byUser.length === 0 ? (
                  <div className={classes.empty}>{t("nothing")}</div>
                ) : (
                  <Table size="small" className={classes.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("cols.user")}</TableCell>
                        <TableCell>{t("cols.finished")}</TableCell>
                        <TableCell>{t("cols.created")}</TableCell>
                        <TableCell>{t("cols.avgWait")}</TableCell>
                        <TableCell>{t("cols.avgService")}</TableCell>
                        <TableCell>{t("cols.sla")}</TableCell>
                        <TableCell>{t("cols.rating")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.byUser.map(u => (
                        <TableRow key={u.userId || "none"}>
                          <TableCell>{u.name || t("noUser")}</TableCell>
                          <TableCell>{u.finished}</TableCell>
                          <TableCell>{u.created}</TableCell>
                          <TableCell>{duration(u.avgWait)}</TableCell>
                          <TableCell>{duration(u.avgService)}</TableCell>
                          <TableCell>{pct(u.slaPercent)}</TableCell>
                          <TableCell>{u.rating ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper elevation={0} className={classes.card}>
                <div className={classes.section}>{t("heatmap")}</div>
                <div
                  className={classes.heat}
                  role="img"
                  aria-label={t("heatmap")}
                >
                  <span />
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={`h${h}`} className={classes.heatHour}>
                      {h % 3 === 0 ? `${h}h` : ""}
                    </span>
                  ))}
                  {data.heatmap.map((row, weekday) => (
                    <React.Fragment key={weekday}>
                      <span className={classes.heatLabel}>
                        {weekdays[weekday]}
                      </span>
                      {row.map((count, hour) => (
                        <Tooltip
                          key={hour}
                          title={t("heatCell", {
                            day: weekdays[weekday],
                            hour,
                            count
                          })}
                        >
                          <span
                            className={classes.heatCell}
                            style={{
                              backgroundColor: count
                                ? `rgba(53, 182, 46, ${0.15 + (0.85 * count) / heatMax})`
                                : theme.komunick.tagBackground
                            }}
                          />
                        </Tooltip>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </Paper>
            </Grid>
          </>
        )}
      </Grid>
    </div>
  );
};

export default Metrics;
