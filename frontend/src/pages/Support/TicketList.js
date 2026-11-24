import React from "react";
import { List, ListItem, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { format, parseISO } from "date-fns";
import { PriorityBadge, StatusBadge } from "./Badges";

// Zap Komunick: list of support tickets (RF-030).
const useStyles = makeStyles(theme => ({
  list: { padding: 0 },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  top: { display: "flex", alignItems: "center", gap: theme.spacing(1) },
  number: { fontFamily: "monospace", fontSize: 12, flexShrink: 0 },
  time: { marginLeft: "auto", flexShrink: 0 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: theme.palette.error.main,
    flexShrink: 0
  },
  title: { overflowWrap: "anywhere" },
  unread: { fontWeight: 700 },
  badges: { display: "flex", flexWrap: "wrap", gap: theme.spacing(0.5) },
  empty: { padding: theme.spacing(3), textAlign: "center" }
}));

export const shortDate = value => {
  if (!value) return "";
  try {
    return format(parseISO(value), "dd/MM HH:mm");
  } catch {
    return "";
  }
};

const TicketList = ({
  tickets,
  selectedId,
  showRequester,
  onSelect,
  empty
}) => {
  const classes = useStyles();

  if (!tickets.length)
    return (
      <Typography className={classes.empty} color="textSecondary">
        {empty}
      </Typography>
    );

  return (
    <List className={classes.list}>
      {tickets.map(ticket => (
        <ListItem
          key={ticket.id}
          button
          className={classes.item}
          selected={ticket.id === selectedId}
          onClick={() => onSelect(ticket.id)}
          aria-label={`${ticket.number} ${ticket.title}`}
        >
          <div className={classes.top}>
            {ticket.unread && (
              <span className={classes.dot} data-testid="support-unread" />
            )}
            <Typography className={classes.number} color="textSecondary">
              {ticket.number}
            </Typography>
            <Typography
              className={classes.time}
              variant="caption"
              color="textSecondary"
            >
              {shortDate(ticket.lastMessageAt)}
            </Typography>
          </div>
          <Typography
            variant="body2"
            className={`${classes.title} ${ticket.unread ? classes.unread : ""}`}
          >
            {ticket.title}
          </Typography>
          {showRequester && (
            <Typography variant="caption" color="textSecondary">
              {[ticket.userName, ticket.companyName]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          )}
          <div className={classes.badges}>
            <StatusBadge ticket={ticket} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </ListItem>
      ))}
    </List>
  );
};

export default TicketList;
