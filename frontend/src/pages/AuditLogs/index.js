import React, { useContext, useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import MenuItem from "@material-ui/core/MenuItem";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import RefreshIcon from "@material-ui/icons/Refresh";
import { Alert } from "@material-ui/lab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Zap Komunick: read-only company audit trail (docs/PRD.md, RF-016).
const EMPTY_FILTERS = { from: "", to: "", userId: "", action: "" };
const ACTION_FAMILIES = ["auth", "security", "user", "setting"];

const useStyles = makeStyles(theme => ({
  content: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(2),
    ...theme.scrollbarStyles
  },
  subtitle: { marginBottom: theme.spacing(2) },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2)
  },
  filter: {
    minWidth: 160,
    flex: "1 1 160px",
    maxWidth: 280,
    [theme.breakpoints.down("xs")]: { maxWidth: "none" }
  },
  actions: { display: "flex", gap: theme.spacing(1) },
  notice: { marginBottom: theme.spacing(2) },
  loading: { display: "flex", alignItems: "center", gap: theme.spacing(1) },
  table: { minWidth: 760 },
  nowrap: { whiteSpace: "nowrap" },
  pager: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2)
  },
  details: {
    margin: 0,
    "& dt": {
      color: theme.komunick.textSecondary,
      marginTop: theme.spacing(1.5)
    },
    "& dd": { margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }
  }
}));

const actionLabel = action => {
  const key = `audit.actions.${String(action).replace(/\./g, "_")}`;
  return i18n.exists(key) ? i18n.t(key) : action;
};

const entityLabel = record => {
  if (!record.entity) return i18n.t("audit.unavailable");
  const key = `audit.entities.${record.entity}`;
  const label = i18n.exists(key) ? i18n.t(key) : record.entity;
  return record.entityId ? `${label} #${record.entityId}` : label;
};

const userLabel = record =>
  record.user?.name ||
  (record.userId
    ? i18n.t("audit.userId", { id: record.userId })
    : i18n.t("audit.noUser"));

const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? i18n.t("audit.unavailable")
    : date.toLocaleString((i18n.language || "pt-BR").replace(/_/g, "-"));
};

const AuditLogs = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState({ ...EMPTY_FILTERS, pageNumber: 1 });
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setUsersError(false);
    api
      .get("/users/list")
      .then(({ data }) => {
        if (active) setUsers(data);
      })
      .catch(() => {
        if (active) setUsersError(true);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, reload]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    setRecords([]);
    setCount(0);
    setHasMore(false);
    const params = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== "")
    );
    api
      .get("/audit-logs", { params })
      .then(({ data }) => {
        if (!active) return;
        setRecords(data.records);
        setCount(data.count);
        setHasMore(data.hasMore);
      })
      .catch(err => {
        if (!active) return;
        const key = `backendErrors.${err.response?.data?.error}`;
        setLoadError(
          i18n.exists(key) ? i18n.t(key) : i18n.t("audit.loadError")
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, query, reload]);

  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const setFilter = name => event => {
    const value = event.target.value;
    setFilters(previous => ({ ...previous, [name]: value }));
  };
  const applyFilters = event => {
    event.preventDefault();
    if (!invalidDates) setQuery({ ...filters, pageNumber: 1 });
  };

  if (!isAdmin) {
    return (
      <MainContainer>
        <Alert severity="warning">{i18n.t("audit.onlyAdmin")}</Alert>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("audit.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => setReload(value => value + 1)}
            disabled={loading}
          >
            {i18n.t("audit.refresh")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper variant="outlined" className={classes.content}>
        <Typography color="textSecondary" className={classes.subtitle}>
          {i18n.t("audit.subtitle")}
        </Typography>
        <form className={classes.filters} onSubmit={applyFilters}>
          <TextField
            className={classes.filter}
            label={i18n.t("audit.from")}
            type="date"
            size="small"
            variant="outlined"
            value={filters.from}
            onChange={setFilter("from")}
            InputLabelProps={{ shrink: true }}
            error={!!invalidDates}
          />
          <TextField
            className={classes.filter}
            label={i18n.t("audit.to")}
            type="date"
            size="small"
            variant="outlined"
            value={filters.to}
            onChange={setFilter("to")}
            InputLabelProps={{ shrink: true }}
            error={!!invalidDates}
            helperText={invalidDates ? i18n.t("audit.invalidDates") : undefined}
          />
          <TextField
            select
            className={classes.filter}
            label={i18n.t("audit.user")}
            size="small"
            variant="outlined"
            value={filters.userId}
            onChange={setFilter("userId")}
          >
            <MenuItem value="">{i18n.t("audit.all")}</MenuItem>
            {users.map(person => (
              <MenuItem key={person.id} value={person.id}>
                {person.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            className={classes.filter}
            label={i18n.t("audit.action")}
            size="small"
            variant="outlined"
            value={filters.action}
            onChange={setFilter("action")}
          >
            <MenuItem value="">{i18n.t("audit.all")}</MenuItem>
            {ACTION_FAMILIES.map(family => (
              <MenuItem key={family} value={`${family}.`}>
                {i18n.t(`audit.families.${family}`)}
              </MenuItem>
            ))}
          </TextField>
          <div className={classes.actions}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || !!invalidDates}
            >
              {i18n.t("audit.apply")}
            </Button>
            <Button
              disabled={loading}
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setQuery({ ...EMPTY_FILTERS, pageNumber: 1 });
              }}
            >
              {i18n.t("audit.clear")}
            </Button>
          </div>
        </form>
        {usersError && (
          <Alert severity="warning" className={classes.notice}>
            {i18n.t("audit.usersError")}
          </Alert>
        )}
        {loadError && (
          <Alert severity="error" className={classes.notice}>
            {loadError}
          </Alert>
        )}
        {loading ? (
          <div className={classes.loading} role="status">
            <CircularProgress size={22} />
            <span>{i18n.t("audit.loading")}</span>
          </div>
        ) : (
          !loadError && (
            <>
              <TableContainer>
                <Table
                  size="small"
                  className={classes.table}
                  aria-label={i18n.t("audit.title")}
                >
                  <TableHead>
                    <TableRow>
                      {[
                        "date",
                        "action",
                        "user",
                        "entity",
                        "ip",
                        "details"
                      ].map(column => (
                        <TableCell key={column}>
                          {i18n.t(`audit.${column}`)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          {i18n.t("audit.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                    {records.map(record => (
                      <TableRow key={record.id}>
                        <TableCell className={classes.nowrap}>
                          {dateLabel(record.createdAt)}
                        </TableCell>
                        <TableCell>{actionLabel(record.action)}</TableCell>
                        <TableCell>{userLabel(record)}</TableCell>
                        <TableCell>{entityLabel(record)}</TableCell>
                        <TableCell>
                          {record.ip || i18n.t("audit.unavailable")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => setSelected(record)}
                            aria-label={i18n.t("audit.openDetails", {
                              id: record.id
                            })}
                          >
                            {i18n.t("audit.details")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <div className={classes.pager}>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  aria-live="polite"
                >
                  {i18n.t("audit.total", { count })}
                </Typography>
                <div className={classes.actions}>
                  <Button
                    disabled={query.pageNumber === 1}
                    onClick={() =>
                      setQuery(previous => ({
                        ...previous,
                        pageNumber: previous.pageNumber - 1
                      }))
                    }
                  >
                    {i18n.t("audit.previous")}
                  </Button>
                  <Typography variant="body2" style={{ alignSelf: "center" }}>
                    {i18n.t("audit.page", { page: query.pageNumber })}
                  </Typography>
                  <Button
                    disabled={!hasMore}
                    onClick={() =>
                      setQuery(previous => ({
                        ...previous,
                        pageNumber: previous.pageNumber + 1
                      }))
                    }
                  >
                    {i18n.t("audit.next")}
                  </Button>
                </div>
              </div>
            </>
          )
        )}
      </Paper>
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="audit-details-title"
      >
        <DialogTitle id="audit-details-title">
          {i18n.t("audit.details")}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <dl className={classes.details}>
              {[
                ["date", dateLabel(selected.createdAt)],
                ["action", actionLabel(selected.action)],
                ["user", userLabel(selected)],
                ["entity", entityLabel(selected)],
                ["ip", selected.ip || i18n.t("audit.unavailable")],
                ["userAgent", selected.userAgent || i18n.t("audit.unavailable")]
              ].map(([field, value]) => (
                <React.Fragment key={field}>
                  <dt>{i18n.t(`audit.${field}`)}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
              <dt>{i18n.t("audit.details")}</dt>
              <dd>
                {selected.details && Object.keys(selected.details).length
                  ? JSON.stringify(selected.details, null, 2)
                  : i18n.t("audit.noDetails")}
              </dd>
            </dl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>
            {i18n.t("audit.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AuditLogs;
