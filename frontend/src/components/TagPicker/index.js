import React, { useCallback, useEffect, useRef, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import useSettings from "../../hooks/useSettings";
import { i18n } from "../../translate/i18n";

// Zap Komunick: pick tags from the ticket list (docs/PRD.md, RF-019). The list
// only offers the tags of the ticket's sector and the global ones.

const useStyles = makeStyles(theme => ({
  list: { width: 260, maxHeight: 320, overflowY: "auto", padding: 4 },
  item: { borderRadius: 8, paddingTop: 0, paddingBottom: 0 },
  check: { minWidth: 34 },
  dot: {
    display: "inline-block",
    width: 10,
    height: 10,
    marginRight: 8,
    borderRadius: "50%",
    verticalAlign: "middle"
  },
  title: {
    padding: "8px 12px 2px",
    fontSize: 12,
    fontWeight: 700,
    color: theme.palette.text.secondary
  },
  empty: { padding: "8px 12px 12px", fontSize: 13 }
}));

export const useSectorTags = (open, queueId) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setTags([]);
    setLoading(true);
    api
      .get("/tags/list", {
        params: queueId == null ? {} : { queueId }
      })
      .then(({ data }) => {
        if (active) setTags(data);
      })
      .catch(err => {
        if (active) toastError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, queueId, revision]);

  return { tags, loading, refresh };
};

export const TagChecklist = ({
  tags,
  checkedIds,
  onToggle,
  loading,
  disabled = false
}) => {
  const classes = useStyles();

  if (loading) {
    return (
      <div className={classes.empty}>
        <CircularProgress size={18} aria-label={i18n.t("tagPicker.title")} />
      </div>
    );
  }

  if (!loading && tags.length === 0) {
    return (
      <Typography className={classes.empty} color="textSecondary">
        {i18n.t("tagPicker.empty")}
      </Typography>
    );
  }

  return (
    <List dense className={classes.list} aria-label={i18n.t("tagPicker.title")}>
      {tags.map(tag => {
        const checked = checkedIds.includes(tag.id);
        return (
          <ListItem
            key={tag.id}
            button
            disabled={disabled || loading}
            className={classes.item}
            onClick={() => onToggle(tag.id)}
          >
            <ListItemIcon className={classes.check}>
              <Checkbox
                edge="start"
                size="small"
                color="primary"
                checked={checked}
                disabled={disabled || loading}
                tabIndex={-1}
                disableRipple
                inputProps={{ "aria-label": tag.name }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <>
                  <span
                    className={classes.dot}
                    style={{ backgroundColor: tag.color || "#ccc" }}
                  />
                  {tag.name}
                </>
              }
            />
          </ListItem>
        );
      })}
    </List>
  );
};

export const TagPickerPopover = ({ anchorEl, onClose, ticket }) => {
  const classes = useStyles();
  const open = Boolean(anchorEl);
  const { getSetting } = useSettings();
  const [tagsMode, setTagsMode] = useState("ticket");
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const { tags, loading } = useSectorTags(open, ticket.queueId || 0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSettingsReady(false);
    getSetting("tagsMode", "ticket")
      .then(mode => {
        if (!active) return;
        setTagsMode(mode);
        setSettingsReady(true);
      })
      .catch(err => {
        if (active) toastError(err);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || savingRef.current) return;
    const current =
      tagsMode === "contact"
        ? ticket.contact?.tags || ticket.tags
        : ticket.tags;
    setCheckedIds((current || []).map(t => t.id));
  }, [open, tagsMode, ticket.id, ticket.tags, ticket.contact?.tags]);

  const toggle = async tagId => {
    if (savingRef.current || loading || !settingsReady) return;
    const previous = checkedIds;
    const next = checkedIds.includes(tagId)
      ? checkedIds.filter(id => id !== tagId)
      : [...checkedIds, tagId];
    savingRef.current = true;
    setSaving(true);
    setCheckedIds(next);
    try {
      await api.post("/tags/sync", {
        ticketId: ticket.id,
        tags: next.map(id => ({ id }))
      });
    } catch (err) {
      if (mountedRef.current) setCheckedIds(previous);
      toastError(err);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => {
        if (!savingRef.current) onClose();
      }}
      onClick={e => e.stopPropagation()}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Typography className={classes.title}>
        {i18n.t("tagPicker.title")}
        {saving && <CircularProgress size={12} style={{ marginLeft: 8 }} />}
      </Typography>
      <TagChecklist
        tags={tags}
        loading={loading}
        disabled={saving || !settingsReady}
        checkedIds={checkedIds}
        onToggle={toggle}
      />
    </Popover>
  );
};
