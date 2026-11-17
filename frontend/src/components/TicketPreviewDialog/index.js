import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  makeStyles
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { formatWhatsappContactName } from "../../helpers/formatWhatsappDisplay";

const useStyles = makeStyles(theme => ({
  message: {
    backgroundColor: theme.komunick.hover,
    borderRadius: theme.shape.borderRadius,
    overflowWrap: "anywhere",
    padding: theme.spacing(2),
    whiteSpace: "pre-wrap"
  },
  messageText: {
    marginTop: theme.spacing(1)
  }
}));

export default function TicketPreviewDialog({
  ticket,
  onClose,
  onAccept,
  accepting
}) {
  const classes = useStyles();
  const [preview, setPreview] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const titleId = `ticket-preview-title-${ticket.id}`;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(`/messages/${ticket.id}/preview`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setPreview(data?.preview ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [ticket.id]);

  const waiting = preview === undefined && !failed;
  const kind = preview && (preview.kind !== "text" || !preview.text);

  return (
    <Dialog
      open
      fullWidth
      maxWidth="xs"
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{i18n.t("ticketPreview.title")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" gutterBottom>
          {formatWhatsappContactName(ticket.contact, ticket)}
        </Typography>
        {failed ? (
          <Typography role="alert" color="error">
            {i18n.t("ticketPreview.unavailable")}
          </Typography>
        ) : waiting ? (
          <Typography role="status" color="textSecondary">
            {i18n.t("ticketPreview.loading")}
          </Typography>
        ) : preview ? (
          <div className={classes.message}>
            {kind && (
              <Typography variant="body2" color="textSecondary">
                {i18n.t(`ticketPreview.kinds.${preview.kind}`)}
              </Typography>
            )}
            {preview.text && (
              <Typography
                variant="body2"
                className={kind ? classes.messageText : undefined}
              >
                {preview.text}
              </Typography>
            )}
          </div>
        ) : (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("ticketPreview.empty")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("common.close")}</Button>
        {onAccept && (
          <Button
            color="primary"
            variant="contained"
            disabled={accepting || waiting || failed}
            onClick={onAccept}
          >
            {i18n.t("ticketPreview.accept")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
