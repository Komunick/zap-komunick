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
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  // the completion message as the client will read it
  completionPreview: {
    margin: theme.spacing(1, 0, 0),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxHeight: 200,
    overflowY: "auto",
    fontSize: "0.9rem"
  },
  actions: { flexWrap: "wrap", gap: 8 }
}));

// Zap Komunick: finish a ticket (docs/PRD.md). Two questions may be put to
// whoever finishes, each one only when the office asks for it:
//  - the reason (RF-007), when `askReason` is on;
//  - whether the client receives the completion message (RF-034), when
//    `completionMessage` brings the text. Then there is no single "finish"
//    button: the person chooses between finishing with or without it. The
//    message only goes with `sendCompletion: true`; nothing is sent by default.
const CloseTicketModal = ({
  open,
  onClose,
  ticket,
  onClosed,
  justClose,
  askReason = true,
  completionMessage = null
}) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [reasons, setReasons] = useState([]);
  const [closeReasonId, setCloseReasonId] = useState("");
  const [closeReasonNote, setCloseReasonNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const asksCompletion = !!completionMessage;

  useEffect(() => {
    if (!open) return;
    setCloseReasonId("");
    setCloseReasonNote("");
    if (!askReason) {
      setReasons([]);
      return;
    }
    setLoading(true);
    api
      .get("/close-reasons")
      .then(({ data }) => setReasons(data))
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [open, askReason]);

  const handleConfirm = async sendCompletion => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: "closed",
        userId: user?.id,
        ...(askReason
          ? {
              closeReasonId: closeReasonId || null,
              closeReasonNote: closeReasonNote.trim() || null
            }
          : {}),
        ...(justClose ? { justClose: true } : {}),
        // asked: the answer goes as it was given, the no as much as the yes
        ...(asksCompletion ? { sendCompletion: sendCompletion === true } : {})
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

  const blocked = saving || (askReason && !closeReasonId);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{i18n.t("closeReasons.modal.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t(
            askReason
              ? "closeReasons.modal.subtitle"
              : "closeCompletion.subtitle",
            { contact: ticket?.contact?.name || "" }
          )}
        </Typography>
        {askReason && (
          <>
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
          </>
        )}
        {asksCompletion && (
          <>
            <Typography
              variant="body2"
              style={{ marginTop: askReason ? 16 : 0 }}
            >
              {i18n.t("closeCompletion.question")}
            </Typography>
            <div
              className={classes.completionPreview}
              data-testid="completion-preview"
            >
              {completionMessage}
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("closeReasons.modal.cancel")}
        </Button>
        {asksCompletion ? (
          <>
            {/* Nothing goes to the client by Enter or by habit: the choice
                that sends is neither the focused one, nor the strong one, nor
                the last one, where the single "Finalizar" always was. */}
            <Button
              variant="outlined"
              color="primary"
              onClick={() => handleConfirm(true)}
              disabled={blocked}
            >
              {i18n.t("closeCompletion.withMessage")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleConfirm(false)}
              disabled={blocked}
              autoFocus={!askReason}
            >
              {i18n.t("closeCompletion.withoutMessage")}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleConfirm(false)}
            disabled={blocked}
          >
            {i18n.t("closeReasons.modal.confirm")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CloseTicketModal;
