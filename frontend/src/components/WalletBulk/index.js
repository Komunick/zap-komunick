import React, { useEffect, useState } from "react";

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

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Zap Komunick: wallet in bulk (docs/PRD.md, RF-014). The bar acts on the
// contacts picked in the list; the dialog moves a whole wallet to someone else.

const NONE = "none";

const useStyles = makeStyles(theme => ({
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    margin: "0 0 8px",
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.komunick.accent}`,
    backgroundColor: theme.komunick.selectedRow
  },
  count: { fontSize: 14, fontWeight: 700, marginRight: "auto" },
  owner: { minWidth: 220 }
}));

const useUsers = open => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!open) return;
    api
      .get("/users/list")
      .then(({ data }) => setUsers(data))
      .catch(toastError);
  }, [open]);
  return users;
};

const report = data => {
  if (data.updated) {
    toast.success(i18n.t("walletBulk.done", { count: data.updated }));
  } else {
    toast.info(i18n.t("walletBulk.nothing"));
  }
  if (data.skippedGroups) {
    toast.info(i18n.t("walletBulk.groups", { count: data.skippedGroups }));
  }
};

export const WalletBulkBar = ({ selectedIds, onDone, onCancel }) => {
  const classes = useStyles();
  const users = useUsers(true);
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async walletUserId => {
    setBusy(true);
    try {
      const { data } = await api.put("/contacts/wallet/bulk", {
        mode: "contacts",
        contactIds: selectedIds,
        walletUserId
      });
      report(data);
      onDone();
    } catch (err) {
      toastError(err);
    }
    setBusy(false);
  };

  return (
    <div className={classes.bar} role="toolbar">
      <span className={classes.count}>
        {i18n.t("walletBulk.selected", { count: selectedIds.length })}
      </span>
      <TextField
        select
        size="small"
        variant="outlined"
        className={classes.owner}
        label={i18n.t("walletBulk.owner")}
        value={owner}
        onChange={e => setOwner(e.target.value)}
      >
        {users.map(user => (
          <MenuItem key={user.id} value={user.id}>
            {user.name}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        color="primary"
        disabled={busy || !owner}
        onClick={() => send(owner)}
      >
        {i18n.t("walletBulk.assign")}
      </Button>
      <Button variant="outlined" disabled={busy} onClick={() => send(null)}>
        {i18n.t("walletBulk.remove")}
      </Button>
      <Button disabled={busy} onClick={onCancel}>
        {i18n.t("walletBulk.cancel")}
      </Button>
    </div>
  );
};

export const WalletTransferDialog = ({ open, onClose, onDone }) => {
  const users = useUsers(open);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom("");
    setTo("");
    setCount(null);
  }, [open]);

  // how many contacts the chosen wallet has
  useEffect(() => {
    if (!open || from === "") {
      setCount(null);
      return;
    }
    api
      .get("/contacts", { params: { walletUserId: from, pageNumber: 1 } })
      .then(({ data }) => setCount(data.count))
      .catch(toastError);
  }, [open, from]);

  const confirm = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/contacts/wallet/bulk", {
        mode: "transfer",
        fromUserId: from === NONE ? null : from,
        walletUserId: to === NONE ? null : to
      });
      report(data);
      if (typeof onDone === "function") onDone();
      onClose();
    } catch (err) {
      toastError(err);
    }
    setBusy(false);
  };

  const same = from !== "" && from === to;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("walletBulk.transferTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("walletBulk.transferHint")}
        </Typography>
        <TextField
          select
          fullWidth
          variant="outlined"
          margin="dense"
          label={i18n.t("walletBulk.from")}
          value={from}
          onChange={e => setFrom(e.target.value)}
          helperText={
            count === null ? " " : i18n.t("walletBulk.fromCount", { count })
          }
        >
          {users.map(user => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
          <MenuItem value={NONE}>{i18n.t("walletBulk.noOwner")}</MenuItem>
        </TextField>
        <TextField
          select
          fullWidth
          variant="outlined"
          margin="dense"
          label={i18n.t("walletBulk.to")}
          value={to}
          onChange={e => setTo(e.target.value)}
          error={same}
          helperText={same ? i18n.t("walletBulk.same") : " "}
        >
          {users.map(user => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
          <MenuItem value={NONE}>{i18n.t("walletBulk.nobody")}</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {i18n.t("walletBulk.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={busy || from === "" || to === "" || same || count === 0}
          onClick={confirm}
        >
          {i18n.t("walletBulk.transfer")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
