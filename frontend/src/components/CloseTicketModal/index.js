import React, { useContext, useEffect, useState } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

// Zap Komunick: finish a ticket with a reason (docs/PRD.md, RF-007)
const CloseTicketModal = ({ open, onClose, ticket, onClosed, justClose }) => {
  const { user } = useContext(AuthContext);
  const [reasons, setReasons] = useState([]);
  const [closeReasonId, setCloseReasonId] = useState("");
  const [closeReasonNote, setCloseReasonNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCloseReasonId("");
    setCloseReasonNote("");
    setLoading(true);
    api
      .get("/close-reasons")
      .then(({ data }) => setReasons(data))
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [open]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: "closed",
        userId: user?.id,
        closeReasonId: closeReasonId || null,
        closeReasonNote: closeReasonNote.trim() || null,
        ...(justClose ? { justClose: true } : {})
      });
      onClose();
      if (typeof onClosed === "function") {
        onClosed();
      }
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("closeReasons.modal.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("closeReasons.modal.subtitle", {
            contact: ticket?.contact?.name || ""
          })}
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : reasons.length === 0 ? (
          <Typography variant="body2" color="error">
            {i18n.t("closeReasons.modal.noReasons")}
          </Typography>
        ) : (
          <TextField
            select
            fullWidth
            required
            variant="outlined"
            margin="dense"
            label={i18n.t("closeReasons.modal.reason")}
            value={closeReasonId}
            onChange={e => setCloseReasonId(e.target.value)}
            autoFocus
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
          minRows={3}
          variant="outlined"
          margin="dense"
          label={i18n.t("closeReasons.modal.note")}
          value={closeReasonNote}
          onChange={e => setCloseReasonNote(e.target.value)}
          inputProps={{ maxLength: 1000 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("closeReasons.modal.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={saving || !closeReasonId}
        >
          {i18n.t("closeReasons.modal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloseTicketModal;
