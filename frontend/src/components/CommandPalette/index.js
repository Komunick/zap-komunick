import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Dialog from "@material-ui/core/Dialog";
import InputBase from "@material-ui/core/InputBase";
import Typography from "@material-ui/core/Typography";
import SearchIcon from "@material-ui/icons/Search";
import clsx from "clsx";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { buildNavItems } from "../../layout/navItems";
import { formatWhatsappContactName } from "../../helpers/formatWhatsappDisplay";

// Zap Komunick: global search and actions (Ctrl K). Lists the pages that match
// the text and searches the tickets the user can see, like the "Search" tab.

const useStyles = makeStyles(theme => ({
  paper: {
    position: "absolute",
    top: "12vh",
    margin: 0,
    width: "min(640px, calc(100% - 32px))",
    borderRadius: 14,
    overflow: "hidden"
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  input: { flex: 1, fontSize: 16, fontFamily: "inherit" },
  results: { maxHeight: 360, overflowY: "auto", padding: 6 },
  group: {
    padding: "10px 12px 4px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "9px 12px",
    borderRadius: 10,
    cursor: "pointer"
  },
  itemActive: {
    backgroundColor: theme.komunick.selectedRow,
    boxShadow: `inset 0 0 0 1px ${theme.komunick.accent}`
  },
  itemText: { minWidth: 0 },
  hint: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  empty: { padding: 20, textAlign: "center" }
}));

const CommandPalette = ({ open, onClose }) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";

  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTickets([]);
      setActive(0);
    }
  }, [open]);

  const pages = useMemo(() => {
    const { main, more } = buildNavItems(isAdmin);
    const text = query.trim().toLowerCase();
    return [...main, ...more]
      .filter(item => !text || item.label.toLowerCase().includes(text))
      .slice(0, text ? 6 : 8);
  }, [query, isAdmin]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setTickets([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/tickets", {
          params: {
            isSearch: true,
            searchParam: text,
            showAll: true,
            tags: "[]",
            users: "[]",
            queueIds: JSON.stringify((user?.queues || []).map(q => q.id))
          }
        });
        setTickets((data.tickets || []).slice(0, 6));
      } catch (err) {
        setTickets([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user]);

  const results = useMemo(
    () => [
      ...pages.map(item => ({
        key: `page-${item.id}`,
        group: i18n.t("layoutMode.goTo"),
        label: item.label,
        to: item.to
      })),
      ...tickets.map(ticket => ({
        key: `ticket-${ticket.id}`,
        group: i18n.t("layoutMode.tickets"),
        label: formatWhatsappContactName(ticket.contact, ticket),
        hint: (ticket.lastMessage || "").replace(/[*_~`]/g, "").split("\n")[0],
        to: `/tickets/${ticket.uuid}`
      }))
    ],
    [pages, tickets]
  );

  useEffect(() => {
    setActive(0);
  }, [query, tickets.length]);

  const go = result => {
    if (!result) return;
    onClose();
    history.push(result.to);
  };

  const handleKeyDown = event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(i => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  let lastGroup = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      classes={{ paper: classes.paper }}
      aria-label={i18n.t("layoutMode.searchPlaceholder")}
    >
      <div className={classes.inputRow}>
        <SearchIcon color="disabled" />
        <InputBase
          autoFocus
          className={classes.input}
          placeholder={i18n.t("layoutMode.searchPlaceholder")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          inputProps={{ "aria-label": i18n.t("layoutMode.searchPlaceholder") }}
        />
      </div>
      <div className={classes.results} role="listbox">
        {results.length === 0 && (
          <Typography
            variant="body2"
            color="textSecondary"
            className={classes.empty}
          >
            {i18n.t("layoutMode.noResults")}
          </Typography>
        )}
        {results.map((result, index) => {
          const header = result.group !== lastGroup;
          lastGroup = result.group;
          return (
            <React.Fragment key={result.key}>
              {header && <div className={classes.group}>{result.group}</div>}
              <div
                role="option"
                aria-selected={index === active}
                className={clsx(
                  classes.item,
                  index === active && classes.itemActive
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
              >
                <Typography variant="body2" noWrap className={classes.itemText}>
                  {result.label}
                </Typography>
                {result.hint && (
                  <span className={classes.hint}>{result.hint}</span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Dialog>
  );
};

export default CommandPalette;
