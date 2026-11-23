import React, { useContext, useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { AuthContext } from "../../context/Auth/AuthContext";
import { toast } from "react-toastify";
import {
  askColleagueText,
  describeOpenTicketConflict
} from "../../helpers/openTicketConflict";

// Zap Komunick: the client already has an open ticket. Tell who has it and
// let the team open or take it (docs/PRD.md, RF-026).
const OpenTicketConflictDialog = ({ openTicket, onClose, onOpenTicket }) => {
  const { user } = useContext(AuthContext);
  const [taking, setTaking] = useState(false);

  if (!openTicket) return null;

  const handleTake = async () => {
    setTaking(true);
    try {
      // accepting a pending ticket must not take it from a colleague who
      // accepted it meanwhile; taking over a ticket in service is the intent
      const { data } = await api.put(`/tickets/${openTicket.id}`, {
        status: "open",
        userId: user.id,
        ...(openTicket.status === "pending" ? { onlyIfPending: true } : {})
      });
      onOpenTicket({ ...data, uuid: data?.uuid || openTicket.uuid });
    } catch (err) {
      if (err?.response?.data?.error === "ERR_TICKET_NOT_PENDING") {
        toast.warn(i18n.t("openTicketConflict.alreadyAccepted"));
        onClose();
      } else {
        toastError(err);
      }
    }
    setTaking(false);
  };

  const cannotTakeHint =
    openTicket.canTake === false &&
    openTicket.user &&
    openTicket.user.id !== user.id
      ? askColleagueText(openTicket)
      : null;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("openTicketConflict.title")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          {describeOpenTicketConflict(openTicket)}
        </Typography>
        {cannotTakeHint && (
          <Typography variant="body2" color="textSecondary">
            {cannotTakeHint}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={taking}>
          {i18n.t("openTicketConflict.close")}
        </Button>
        {openTicket.canView && (
          <Button
            variant="outlined"
            color="primary"
            disabled={taking}
            onClick={() => onOpenTicket(openTicket)}
          >
            {i18n.t("openTicketConflict.open")}
          </Button>
        )}
        {openTicket.canTake && (
          <ButtonWithSpinner
            variant="contained"
            color="primary"
            loading={taking}
            onClick={handleTake}
          >
            {openTicket.status === "pending"
              ? i18n.t("openTicketConflict.accept")
              : i18n.t("openTicketConflict.take")}
          </ButtonWithSpinner>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default OpenTicketConflictDialog;
