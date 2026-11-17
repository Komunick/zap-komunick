import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Tooltip,
  Typography
} from "@material-ui/core";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1, 1.5)
  },
  hint: {
    color: theme.palette.text.secondary
  },
  number: {
    display: "inline-block",
    minWidth: 28,
    fontWeight: 600
  },
  color: {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginRight: theme.spacing(1)
  }
}));

// Moves the queue at `index` one place up (-1) or down (+1) in the menu order.
export const moveQueueId = (queueIds, index, direction) => {
  const target = index + direction;
  if (index < 0 || index >= queueIds.length) return queueIds;
  if (target < 0 || target >= queueIds.length) return queueIds;
  const next = [...queueIds];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// Order of the queues in the bot menu of the channel. The customer answers
// with the number shown here; the order is saved with the channel.
const QueueOrderList = ({ queueIds, queues, onChange }) => {
  const classes = useStyles();

  if (!queueIds || queueIds.length < 2) return null;

  const nameOf = id => queues.find(queue => queue.id === id);

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography variant="subtitle2">
        {i18n.t("whatsappModal.queueOrder.title")}
      </Typography>
      <Typography variant="caption" className={classes.hint}>
        {i18n.t("whatsappModal.queueOrder.hint")}
      </Typography>
      <List dense disablePadding>
        {queueIds.map((id, index) => {
          const queue = nameOf(id);
          const name = queue?.name || `#${id}`;
          return (
            <ListItem key={id} disableGutters>
              <ListItemText
                primary={
                  <>
                    <span className={classes.number}>{index + 1}</span>
                    {queue?.color && (
                      <span
                        className={classes.color}
                        style={{ backgroundColor: queue.color }}
                      />
                    )}
                    {name}
                  </>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title={i18n.t("whatsappModal.queueOrder.up")}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={i18n.t("whatsappModal.queueOrder.upLabel", {
                        name
                      })}
                      disabled={index === 0}
                      onClick={() => onChange(moveQueueId(queueIds, index, -1))}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={i18n.t("whatsappModal.queueOrder.down")}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={i18n.t("whatsappModal.queueOrder.downLabel", {
                        name
                      })}
                      disabled={index === queueIds.length - 1}
                      onClick={() => onChange(moveQueueId(queueIds, index, 1))}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
};

export default QueueOrderList;
