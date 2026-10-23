import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton } from "@material-ui/core";
import { MoreVert, Replay } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import UndoRoundedIcon from "@material-ui/icons/UndoRounded";
import AddBoxIcon from "@material-ui/icons/AddBox";
import { Call, CallEnd } from "@material-ui/icons";
import Tooltip from "@material-ui/core/Tooltip";
import { PhoneCallContext } from "../../context/PhoneCall/PhoneCallContext";
import { wavoipAvailable, wavoipCall } from "../../helpers/wavoipCallManager";
import { toBeChecked } from "@testing-library/jest-dom/matchers";
// Zap Komunick: pause, transfer and close reason (docs/PRD.md, RF-007)
import Button from "@material-ui/core/Button";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import PlayArrowRoundedIcon from "@material-ui/icons/PlayArrowRounded";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import DoneRoundedIcon from "@material-ui/icons/DoneRounded";
import CloseTicketModal from "../CloseTicketModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import useSettings from "../../hooks/useSettings";

const useStyles = makeStyles(theme => ({
  actionButtons: {
    marginRight: 6,
    flex: "none",
    alignSelf: "center",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    "& > *": {
      margin: theme.spacing(0.5)
    }
  },
  finishButton: {
    whiteSpace: "nowrap"
  }
}));

const TicketActionButtonsCustom = ({ ticket, showTabGroups }) => {
  const classes = useStyles();
  const history = useHistory();
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const ticketOptionsMenuOpen = Boolean(anchorEl);
  const { user } = useContext(AuthContext);
  const { setCurrentTicket } = useContext(TicketsContext);
  const phoneContext = useContext(PhoneCallContext);
  const { getSetting } = useSettings();
  const [closeReasonRequired, setCloseReasonRequired] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  useEffect(() => {
    getSetting("closeReasonRequired", "disabled")
      .then(value => setCloseReasonRequired(value === "enabled"))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const handleOpenTicketOptionsMenu = e => {
    setAnchorEl(e.currentTarget);
  };

  const handleCloseTicketOptionsMenu = e => {
    setAnchorEl(null);
  };

  const handleUpdateTicketStatus = async (e, status, userId) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: status,
        userId: userId || null
      });

      setLoading(false);
      if (status === "open" || status === "paused") {
        setCurrentTicket({ ...ticket, code: "#open" });
      } else {
        setCurrentTicket({ id: null, code: null });
        history.push("/tickets");
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  const handleFinish = e => {
    if (closeReasonRequired && !ticket.isGroup) {
      setCloseModalOpen(true);
      return;
    }
    handleUpdateTicketStatus(e, "closed", user?.id);
  };

  const handleClosedWithReason = () => {
    setCurrentTicket({ id: null, code: null });
    history.push("/tickets");
  };

  const finishButton = (
    <Button
      size="small"
      variant="contained"
      color="primary"
      disableElevation
      className={classes.finishButton}
      startIcon={<DoneRoundedIcon />}
      disabled={loading}
      onClick={handleFinish}
    >
      {i18n.t("messagesList.header.buttons.finish")}
    </Button>
  );

  const optionsMenu = (
    <>
      <IconButton onClick={handleOpenTicketOptionsMenu}>
        <MoreVert />
      </IconButton>
      <TicketOptionsMenu
        ticket={ticket}
        anchorEl={anchorEl}
        menuOpen={ticketOptionsMenuOpen}
        handleClose={handleCloseTicketOptionsMenu}
        showTabGroups={showTabGroups}
      />
    </>
  );

  const handleCall = async () => {
    wavoipCall(ticket, () => {
      phoneContext.disconnect();
    })
      .then(wavoipInstance => {
        phoneContext.updateCurrentCall({
          contact: ticket.contact,
          whatsapp: ticket.whatsapp,
          disconnect: () => {
            window.wavoipCallingSound.stop();
            wavoipInstance.endCall();
          }
        });
      })
      .catch(err => {
        toastError(err);
      });
  };

  return (
    <div className={classes.actionButtons}>
      <CloseTicketModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        ticket={ticket}
        onClosed={handleClosedWithReason}
      />
      <TransferTicketModalCustom
        modalOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        ticketid={ticket.id}
        hideUserSelection={showTabGroups && ticket.isGroup}
      />
      {ticket.status === "closed" && (!showTabGroups || !ticket.isGroup) && (
        <>
          <Tooltip title={i18n.t("ticketsManager.buttons.newTicket")}>
            <IconButton
              onClick={() =>
                window.mentionClick({
                  contactId: ticket.contactId,
                  name: ticket.contact?.name,
                  number: ticket.contact?.number
                })
              }
            >
              <AddBoxIcon />
            </IconButton>
          </Tooltip>
          {user.profile === "admin" && (
            <Tooltip title={i18n.t("messagesList.header.buttons.reopen")}>
              <IconButton
                onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
              >
                <Replay />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
      {(ticket.status === "open" || (showTabGroups && ticket.isGroup)) && (
        <>
          {wavoipAvailable() &&
            phoneContext &&
            !phoneContext.currentCall &&
            ticket.whatsapp.wavoip?.token &&
            !ticket.contact.isGroup && (
              <Tooltip title={i18n.t("messagesList.header.buttons.call")}>
                <IconButton onClick={handleCall}>
                  <Call />
                </IconButton>
              </Tooltip>
            )}

          {wavoipAvailable() &&
            phoneContext &&
            phoneContext.currentCall &&
            phoneContext.currentCall.contact.id === ticket.contact.id &&
            phoneContext.currentCall.whatsapp.id === ticket.whatsapp.id && (
              <Tooltip title={i18n.t("messagesList.header.buttons.endCall")}>
                <IconButton onClick={phoneContext.disconnect}>
                  <CallEnd />
                </IconButton>
              </Tooltip>
            )}

          {(!showTabGroups || !ticket.isGroup) && (
            <>
              <Tooltip title={i18n.t("messagesList.header.buttons.return")}>
                <IconButton
                  onClick={e => handleUpdateTicketStatus(e, "pending", null)}
                >
                  <UndoRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={i18n.t("messagesList.header.buttons.transfer")}>
                <IconButton onClick={() => setTransferModalOpen(true)}>
                  <SwapHorizIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={i18n.t("messagesList.header.buttons.pause")}>
                <IconButton
                  disabled={loading}
                  onClick={e => handleUpdateTicketStatus(e, "paused", user?.id)}
                >
                  <PauseCircleOutlineIcon />
                </IconButton>
              </Tooltip>
              {finishButton}
            </>
          )}

          {optionsMenu}
        </>
      )}
      {ticket.status === "paused" && (!showTabGroups || !ticket.isGroup) && (
        <>
          <ButtonWithSpinner
            loading={loading}
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PlayArrowRoundedIcon />}
            onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
          >
            {i18n.t("messagesList.header.buttons.resume")}
          </ButtonWithSpinner>
          {finishButton}
          {optionsMenu}
        </>
      )}
      {ticket.status === "pending" && (!showTabGroups || !ticket.isGroup) && (
        <ButtonWithSpinner
          loading={loading}
          size="small"
          variant="contained"
          color="primary"
          onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
        >
          {i18n.t("messagesList.header.buttons.accept")}
        </ButtonWithSpinner>
      )}
    </div>
  );
};

export default TicketActionButtonsCustom;
