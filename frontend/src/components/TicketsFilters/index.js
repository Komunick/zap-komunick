import React, { useContext, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Badge from "@material-ui/core/Badge";
import Button from "@material-ui/core/Button";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Popover from "@material-ui/core/Popover";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import Tooltip from "@material-ui/core/Tooltip";
import FilterListIcon from "@material-ui/icons/FilterList";
import clsx from "clsx";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import useSettings from "../../hooks/useSettings";

// Zap Komunick: filter panel of the ticket list (docs/PRD.md, RF-012). The
// filters add to the view, the queue chips and the search, in every view.

export const EMPTY_FILTERS = {
  whatsappIds: [],
  userIds: [],
  tagIds: [],
  createdFrom: "",
  createdTo: "",
  unread: false,
  slaBreached: false,
  wallet: ""
};

export const countFilters = filters =>
  (filters.whatsappIds.length ? 1 : 0) +
  (filters.userIds.length ? 1 : 0) +
  (filters.tagIds.length ? 1 : 0) +
  (filters.createdFrom || filters.createdTo ? 1 : 0) +
  (filters.unread ? 1 : 0) +
  (filters.slaBreached ? 1 : 0) +
  (filters.wallet ? 1 : 0);

// query parameters of GET /tickets; empty filters send nothing
export const filtersToParams = filters => {
  if (!filters || countFilters(filters) === 0) return {};
  const params = {};
  if (filters.whatsappIds.length) {
    params.whatsappIds = JSON.stringify(filters.whatsappIds);
  }
  if (filters.userIds.length) params.userIds = JSON.stringify(filters.userIds);
  if (filters.tagIds.length) params.filterTags = JSON.stringify(filters.tagIds);
  if (filters.createdFrom) params.createdFrom = filters.createdFrom;
  if (filters.createdTo) params.createdTo = filters.createdTo;
  if (filters.unread) params.unread = "true";
  if (filters.slaBreached) params.slaBreached = "true";
  if (filters.wallet) params.wallet = filters.wallet;
  return params;
};

/**
 * Same rules as the backend, for the tickets that arrive by the socket: a
 * ticket that stops matching leaves the list. Fields the event does not carry
 * do not exclude the ticket.
 */
export const ticketMatchesFilters = (ticket, filters, ctx) => {
  if (!filters || countFilters(filters) === 0) return true;
  if (
    filters.whatsappIds.length &&
    ticket.whatsappId !== undefined &&
    !filters.whatsappIds.includes(ticket.whatsappId)
  ) {
    return false;
  }
  if (
    filters.userIds.length &&
    ctx.isAdmin &&
    !filters.userIds.includes(ticket.userId)
  ) {
    return false;
  }
  if (filters.tagIds.length) {
    const ids = [
      ...(ticket.tags || []).map(t => t.id),
      ...(ticket.contact?.tags || []).map(t => t.id)
    ];
    if (!filters.tagIds.every(id => ids.includes(id))) return false;
  }
  const created = ticket.createdAt ? ticket.createdAt.slice(0, 10) : null;
  if (filters.createdFrom && created && created < filters.createdFrom) {
    return false;
  }
  if (filters.createdTo && created && created > filters.createdTo) return false;
  if (filters.unread && !(Number(ticket.unreadMessages) > 0)) return false;
  if (filters.slaBreached) {
    const since = ticket.unansweredSince
      ? new Date(ticket.unansweredSince).getTime()
      : null;
    const breached =
      ctx.slaMinutes > 0 &&
      ["open", "pending"].includes(ticket.status) &&
      !ticket.chatbot &&
      since !== null &&
      Date.now() - since >= ctx.slaMinutes * 60000;
    if (!breached) return false;
  }
  const walletUserId = ticket.contact?.walletUserId;
  if (filters.wallet && walletUserId !== undefined) {
    if (filters.wallet === "mine" && walletUserId !== ctx.userId) return false;
    if (filters.wallet === "none" && walletUserId) return false;
  }
  return true;
};

const useStyles = makeStyles(theme => ({
  trigger: {
    marginLeft: 6,
    textTransform: "none",
    fontWeight: 600,
    color: theme.palette.text.secondary
  },
  triggerOn: { color: theme.komunick.accent },
  panel: {
    width: 340,
    maxWidth: "calc(100vw - 32px)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14
  },
  title: { fontSize: 16, fontWeight: 700 },
  group: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background: "none",
    font: "inherit",
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    "&:focus-visible": { outline: `2px solid ${theme.komunick.accent}` }
  },
  chipOn: {
    color: theme.palette.text.primary,
    borderColor: theme.komunick.accent,
    backgroundColor: theme.komunick.selectedRow
  },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  dates: { display: "flex", gap: 8 },
  switchLabel: {
    margin: 0,
    justifyContent: "space-between",
    "& .MuiFormControlLabel-label": { fontSize: 14 }
  },
  actions: { display: "flex", justifyContent: "space-between", gap: 8 }
}));

const ChipGroup = ({ label, items, selected, onToggle, colorOf }) => {
  const classes = useStyles();
  if (!items.length) return null;
  return (
    <div className={classes.group}>
      <span className={classes.label}>{label}</span>
      <div className={classes.chips}>
        {items.map(item => {
          const on = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              className={clsx(classes.chip, on && classes.chipOn)}
              onClick={() => onToggle(item.id)}
            >
              {colorOf && (
                <span
                  className={classes.dot}
                  style={{ backgroundColor: colorOf(item) || "#7C7C7C" }}
                />
              )}
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TicketsFilterButton = ({ filters, onChange }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { getSetting } = useSettings();
  const isAdmin = user?.profile === "admin";
  const [anchor, setAnchor] = useState(null);
  const [draft, setDraft] = useState(filters);
  const [whatsapps, setWhatsapps] = useState([]);
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [slaMinutes, setSlaMinutes] = useState(0);

  const active = countFilters(filters);

  useEffect(() => {
    if (!anchor) return;
    setDraft(filters);
    Promise.all([
      api.get("/whatsapp"),
      api.get("/tags/list"),
      isAdmin ? api.get("/users/list") : Promise.resolve({ data: [] })
    ])
      .then(([w, t, u]) => {
        setWhatsapps(w.data || []);
        setTags(t.data || []);
        setUsers(u.data || []);
      })
      .catch(toastError);
    getSetting("slaMinutes", "0")
      .then(value => setSlaMinutes(Number(value) || 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  const toggleIn = key => id =>
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter(x => x !== id)
        : [...prev[key], id]
    }));

  const apply = next => {
    onChange(next);
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title={i18n.t("tickets.filters.title")}>
        <Button
          size="small"
          className={clsx(classes.trigger, active > 0 && classes.triggerOn)}
          onClick={e => setAnchor(e.currentTarget)}
          aria-label={i18n.t("tickets.filters.title")}
          startIcon={
            <Badge badgeContent={active} color="primary">
              <FilterListIcon fontSize="small" />
            </Badge>
          }
        >
          {i18n.t("tickets.filters.button")}
        </Button>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <div
          className={classes.panel}
          role="dialog"
          aria-label={i18n.t("tickets.filters.title")}
        >
          <span className={classes.title}>
            {i18n.t("tickets.filters.title")}
          </span>

          <ChipGroup
            label={i18n.t("tickets.filters.connections")}
            items={whatsapps}
            selected={draft.whatsappIds}
            onToggle={toggleIn("whatsappIds")}
          />
          {isAdmin && (
            <ChipGroup
              label={i18n.t("tickets.filters.attendants")}
              items={users}
              selected={draft.userIds}
              onToggle={toggleIn("userIds")}
            />
          )}
          <ChipGroup
            label={i18n.t("tickets.filters.tags")}
            items={tags}
            selected={draft.tagIds}
            onToggle={toggleIn("tagIds")}
            colorOf={tag => tag.color}
          />

          <div className={classes.group}>
            <span className={classes.label}>
              {i18n.t("tickets.filters.period")}
            </span>
            <div className={classes.dates}>
              <TextField
                type="date"
                size="small"
                variant="outlined"
                label={i18n.t("tickets.filters.from")}
                InputLabelProps={{ shrink: true }}
                value={draft.createdFrom}
                onChange={e =>
                  setDraft(prev => ({ ...prev, createdFrom: e.target.value }))
                }
              />
              <TextField
                type="date"
                size="small"
                variant="outlined"
                label={i18n.t("tickets.filters.to")}
                InputLabelProps={{ shrink: true }}
                value={draft.createdTo}
                onChange={e =>
                  setDraft(prev => ({ ...prev, createdTo: e.target.value }))
                }
              />
            </div>
          </div>

          <div className={classes.group}>
            <span className={classes.label}>
              {i18n.t("tickets.filters.wallet")}
            </span>
            <div className={classes.chips}>
              {["", "mine", "none"].map(value => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={draft.wallet === value}
                  className={clsx(
                    classes.chip,
                    draft.wallet === value && classes.chipOn
                  )}
                  onClick={() => setDraft(prev => ({ ...prev, wallet: value }))}
                >
                  {i18n.t(`tickets.filters.wallet_${value || "all"}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={classes.group}>
            <FormControlLabel
              className={classes.switchLabel}
              labelPlacement="start"
              label={i18n.t("tickets.filters.unread")}
              control={
                <Switch
                  color="primary"
                  size="small"
                  checked={draft.unread}
                  onChange={e =>
                    setDraft(prev => ({ ...prev, unread: e.target.checked }))
                  }
                />
              }
            />
            <FormControlLabel
              className={classes.switchLabel}
              labelPlacement="start"
              disabled={slaMinutes === 0}
              label={
                slaMinutes === 0
                  ? i18n.t("tickets.filters.slaOff")
                  : i18n.t("tickets.filters.sla", { minutes: slaMinutes })
              }
              control={
                <Switch
                  color="primary"
                  size="small"
                  checked={draft.slaBreached}
                  onChange={e =>
                    setDraft(prev => ({
                      ...prev,
                      slaBreached: e.target.checked
                    }))
                  }
                />
              }
            />
          </div>

          <div className={classes.actions}>
            <Button onClick={() => apply(EMPTY_FILTERS)}>
              {i18n.t("tickets.filters.clear")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={
                !!draft.createdFrom &&
                !!draft.createdTo &&
                draft.createdFrom > draft.createdTo
              }
              onClick={() => apply(draft)}
            >
              {i18n.t("tickets.filters.apply")}
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
};
