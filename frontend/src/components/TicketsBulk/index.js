import React, { createContext, useEffect, useMemo, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { toast } from "react-toastify";

import { TagChecklist, useSectorTags } from "../TagPicker";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Zap Komunick: select many tickets in the list and accept, transfer or close
// them at once (docs/PRD.md, RF-011). The lists register what they show, the
// rows read the selection and the bar sends POST /tickets/bulk.

export const BulkSelectionContext = createContext(null);

const useStyles = makeStyles(theme => ({
  bar: {
    flex: "none",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    margin: "0 8px 8px",
    padding: "8px 10px",
    borderRadius: 12,
    border: `1px solid ${theme.komunick.accent}`,
    backgroundColor: theme.komunick.selectedRow
  },
  count: {
    flexBasis: "100%",
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 13,
    fontWeight: 700
  },
  link: {
    padding: 0,
    border: 0,
    background: "none",
    font: "inherit",
    fontSize: 12,
    fontWeight: 600,
    color: theme.komunick.accent,
    cursor: "pointer",
    textDecoration: "underline"
  },
  action: { minWidth: 0, padding: "3px 10px", fontSize: 13 }
}));

export function useBulkSelectionState() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [lists, setLists] = useState({});

  return useMemo(
    () => ({
      selecting,
      selected,
      lists,
      start: () => setSelecting(true),
      stop: () => {
        setSelecting(false);
        setSelected([]);
      },
      isSelected: id => selected.includes(id),
      toggle: id =>
        setSelected(prev =>
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        ),
      setSelected,
      register: (key, tickets) =>
        setLists(prev => ({
          ...prev,
          [key]: tickets.map(t => ({ id: t.id, status: t.status }))
        }))
    }),
    [selecting, selected, lists]
  );
}

const TransferDialog = ({ open, onClose, onConfirm, busy }) => {
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);
  const [queueId, setQueueId] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (!open) return;
    setQueueId("");
    setUserId("");
    Promise.all([api.get("/queue"), api.get("/users/list")])
      .then(([q, u]) => {
        setQueues(q.data);
        setUsers(u.data);
      })
      .catch(toastError);
  }, [open]);

  const queueUsers = users.filter(u =>
    (u.queues || []).some(q => q.id === queueId)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("tickets.bulk.transferTitle")}</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          variant="outlined"
          margin="dense"
          label={i18n.t("tickets.bulk.queue")}
          value={queueId}
          onChange={e => {
            setQueueId(e.target.value);
            setUserId("");
          }}
        >
          {queues.map(queue => (
            <MenuItem key={queue.id} value={queue.id}>
              {queue.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          variant="outlined"
          margin="dense"
          label={i18n.t("tickets.bulk.user")}
          value={userId}
          onChange={e => setUserId(e.target.value)}
          disabled={!queueId}
          helperText={i18n.t("tickets.bulk.userHint")}
        >
          <MenuItem value="">{i18n.t("tickets.bulk.noUser")}</MenuItem>
          {queueUsers.map(user => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {i18n.t("tickets.bulk.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={busy || !queueId}
          onClick={() => onConfirm({ queueId, userId: userId || null })}
        >
          {i18n.t("tickets.bulk.transfer")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CloseDialog = ({ open, onClose, onConfirm, busy, count }) => {
  const [reasons, setReasons] = useState([]);
  const [closeReasonId, setCloseReasonId] = useState("");
  const [closeReasonNote, setCloseReasonNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setCloseReasonId("");
    setCloseReasonNote("");
    api
      .get("/close-reasons")
      .then(({ data }) => setReasons(data))
      .catch(toastError);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("tickets.bulk.closeTitle", { count })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("tickets.bulk.closeHint")}
        </Typography>
        {reasons.length > 0 && (
          <TextField
            select
            fullWidth
            variant="outlined"
            margin="dense"
            label={i18n.t("closeReasons.modal.reason")}
            value={closeReasonId}
            onChange={e => setCloseReasonId(e.target.value)}
          >
            {reasons.map(reason => (
              <MenuItem key={reason.id} value={reason.id}>
                {reason.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          variant="outlined"
          margin="dense"
          label={i18n.t("closeReasons.modal.note")}
          value={closeReasonNote}
          onChange={e => setCloseReasonNote(e.target.value)}
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {i18n.t("tickets.bulk.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={busy || (reasons.length > 0 && !closeReasonId)}
          onClick={() =>
            onConfirm({
              closeReasonId: closeReasonId || null,
              closeReasonNote: closeReasonNote.trim() || null
            })
          }
        >
          {i18n.t("tickets.bulk.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Zap Komunick: add tags to every picked ticket (RF-019)
const TagDialog = ({ open, onClose, onConfirm, busy, count }) => {
  const [tagIds, setTagIds] = useState([]);
  const { tags, loading } = useSectorTags(open);

  useEffect(() => {
    if (open) setTagIds([]);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("tickets.bulk.tagTitle", { count })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary">
          {i18n.t("tickets.bulk.tagHelp")}
        </Typography>
        <TagChecklist
          tags={tags}
          loading={loading}
          checkedIds={tagIds}
          onToggle={id =>
            setTagIds(prev =>
              prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            )
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {i18n.t("tickets.bulk.cancel")}
        </Button>
        <Button
          color="primary"
          variant="contained"
          disabled={busy || tagIds.length === 0}
          onClick={() => onConfirm({ tagIds })}
        >
          {i18n.t("tickets.bulk.tagConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const BulkBar = ({ selection, listKey }) => {
  const classes = useStyles();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const visible = selection.lists[listKey] || [];
  const chosen = visible.filter(t => selection.selected.includes(t.id));
  const pending = chosen.filter(t => t.status === "pending");
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  const run = async (action, extra = {}, ids = chosen.map(t => t.id)) => {
    setBusy(true);
    try {
      const { data } = await api.post("/tickets/bulk", {
        action,
        ticketIds: ids,
        ...extra
      });
      if (data.done.length) {
        toast.success(i18n.t("tickets.bulk.done", { count: data.done.length }));
      }
      if (data.failed.length) {
        toast.warn(
          i18n.t("tickets.bulk.failed", { count: data.failed.length })
        );
      }
      setDialog(null);
      selection.stop();
    } catch (err) {
      toastError(err);
    }
    setBusy(false);
  };

  return (
    <>
      <div className={classes.bar} role="toolbar">
        <span className={classes.count}>
          {i18n.t("tickets.bulk.selected", { count: chosen.length })}
          <button
            type="button"
            className={classes.link}
            onClick={() =>
              selection.setSelected(allChosen ? [] : visible.map(t => t.id))
            }
          >
            {allChosen
              ? i18n.t("tickets.bulk.none")
              : i18n.t("tickets.bulk.all", { count: visible.length })}
          </button>
        </span>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          className={classes.action}
          disabled={busy || pending.length === 0}
          onClick={() =>
            run(
              "accept",
              {},
              pending.map(t => t.id)
            )
          }
        >
          {pending.length && pending.length !== chosen.length
            ? i18n.t("tickets.bulk.acceptSome", { count: pending.length })
            : i18n.t("tickets.bulk.accept")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          className={classes.action}
          disabled={busy || chosen.length === 0}
          onClick={() => setDialog("transfer")}
        >
          {i18n.t("tickets.bulk.transfer")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          className={classes.action}
          disabled={busy || chosen.length === 0}
          onClick={() => setDialog("tag")}
        >
          {i18n.t("tickets.bulk.tag")}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="primary"
          className={classes.action}
          disabled={busy || chosen.length === 0}
          onClick={() => setDialog("close")}
        >
          {i18n.t("tickets.bulk.close")}
        </Button>
        <Button
          size="small"
          className={classes.action}
          onClick={selection.stop}
          disabled={busy}
        >
          {i18n.t("tickets.bulk.cancel")}
        </Button>
      </div>
      <TransferDialog
        open={dialog === "transfer"}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={extra => run("transfer", extra)}
      />
      <TagDialog
        open={dialog === "tag"}
        busy={busy}
        count={chosen.length}
        onClose={() => setDialog(null)}
        onConfirm={extra => run("tag", extra)}
      />
      <CloseDialog
        open={dialog === "close"}
        busy={busy}
        count={chosen.length}
        onClose={() => setDialog(null)}
        onConfirm={extra => run("close", extra)}
      />
    </>
  );
};
