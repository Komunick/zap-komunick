import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { makeStyles } from "@material-ui/core";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
  createFilterOptions
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import Checkbox from "@material-ui/core/Checkbox";
import Typography from "@material-ui/core/Typography";
import { format, parseISO } from "date-fns";

const useStyles = makeStyles(theme => ({
  // Zap Komunick: context for the sector that receives (RF-017)
  context: { marginTop: 20, width: 420, maxWidth: "100%", display: "block" },
  pick: { marginTop: 16, width: 420, maxWidth: "100%" },
  pickTitle: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  pickList: {
    maxHeight: 220,
    overflowY: "auto",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10
  },
  pickRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px 2px 0",
    fontSize: 13,
    cursor: "pointer",
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: 0 }
  },
  pickMeta: {
    flex: "none",
    fontSize: 11,
    color: theme.palette.text.secondary
  },
  pickBody: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  maxWidth: {
    width: "100%"
  }
}));

const filterOptions = createFilterOptions({
  trim: true
});

const TransferTicketModalCustom = ({
  modalOpen,
  onClose,
  ticketid,
  hideUserSelection = false
}) => {
  const history = useHistory();
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  // Zap Komunick: context for the sector that receives (RF-017)
  const [note, setNote] = useState("");
  const [recentMessages, setRecentMessages] = useState([]);
  const [pickedIds, setPickedIds] = useState([]);
  const classes = useStyles();
  const { findAll: findAllQueues } = useQueues();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hideUserSelection || !modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam }
          });
          setOptions(data.users);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen, hideUserSelection]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedUser(null);
    setNote("");
    setPickedIds([]);
  };

  useEffect(() => {
    if (!modalOpen || !ticketid) return;
    api
      .get(`/messages/${ticketid}`)
      .then(({ data }) => {
        setRecentMessages(
          (data.messages || [])
            .filter(
              m =>
                Number(m.ticketId) === Number(ticketid) &&
                !["reactionMessage", "transferNote"].includes(m.mediaType) &&
                (m.body || m.mediaType)
            )
            .slice(-15)
            .reverse()
        );
      })
      .catch(() => setRecentMessages([]));
  }, [modalOpen, ticketid]);

  const togglePicked = id =>
    setPickedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleSaveTicket = async e => {
    e.preventDefault();
    if (!ticketid) return;
    if (!selectedQueue || selectedQueue === "") return;
    setLoading(true);
    try {
      let data = {};

      if (selectedUser) {
        data.userId = selectedUser.id;
      }

      if (selectedQueue && selectedQueue !== null) {
        data.queueId = selectedQueue;

        if (!selectedUser) {
          data.status = "pending";
          data.userId = null;
        }
      }

      if (note.trim() || pickedIds.length) {
        data.transferNote = note.trim();
        data.transferMessageIds = pickedIds;
      }

      await api.put(`/tickets/${ticketid}`, data);
      console.log(data);

      history.push(`/tickets`);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <Dialog open={modalOpen} onClose={handleClose} maxWidth="lg" scroll="paper">
      <form onSubmit={handleSaveTicket}>
        <DialogTitle id="form-dialog-title">
          {i18n.t("transferTicketModal.title")}
        </DialogTitle>
        <DialogContent dividers>
          {!hideUserSelection && (
            <Autocomplete
              style={{ width: 300, marginBottom: 20 }}
              getOptionLabel={option => `${option.name}`}
              onChange={(e, newValue) => {
                setSelectedUser(newValue);
                if (newValue != null && Array.isArray(newValue.queues)) {
                  setQueues(newValue.queues);
                } else {
                  setQueues(allQueues);
                  setSelectedQueue("");
                }
              }}
              options={options}
              filterOptions={filterOptions}
              freeSolo
              autoHighlight
              noOptionsText={i18n.t("transferTicketModal.noOptions")}
              loading={loading}
              renderInput={params => (
                <TextField
                  {...params}
                  label={i18n.t("transferTicketModal.fieldLabel")}
                  variant="outlined"
                  autoFocus
                  onChange={e => setSearchParam(e.target.value)}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {loading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    )
                  }}
                />
              )}
            />
          )}
          <FormControl variant="outlined" className={classes.maxWidth}>
            <InputLabel>
              {i18n.t("transferTicketModal.fieldQueueLabel")}
            </InputLabel>
            <Select
              value={selectedQueue}
              onChange={e => setSelectedQueue(e.target.value)}
              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
            >
              {queues.map(queue => (
                <MenuItem key={queue.id} value={queue.id}>
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            className={classes.context}
            label={i18n.t("transferContext.noteLabel")}
            placeholder={i18n.t("transferContext.notePlaceholder")}
            helperText={i18n.t("transferContext.noteHint")}
            variant="outlined"
            multiline
            minRows={3}
            fullWidth
            value={note}
            inputProps={{ maxLength: 2000 }}
            onChange={e => setNote(e.target.value)}
          />
          {recentMessages.length > 0 && (
            <div className={classes.pick}>
              <Typography className={classes.pickTitle}>
                {i18n.t("transferContext.pickTitle")}
              </Typography>
              <div className={classes.pickList}>
                {recentMessages.map(message => (
                  <label key={message.id} className={classes.pickRow}>
                    <Checkbox
                      size="small"
                      color="primary"
                      checked={pickedIds.includes(message.id)}
                      onChange={() => togglePicked(message.id)}
                    />
                    <span className={classes.pickMeta}>
                      {message.fromMe
                        ? i18n.t("transferContext.us")
                        : i18n.t("transferContext.client")}{" "}
                      · {format(parseISO(message.createdAt), "dd/MM HH:mm")}
                    </span>
                    <span className={classes.pickBody}>
                      {message.body || `[${message.mediaType}]`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={loading}
            variant="outlined"
          >
            {i18n.t("transferTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="submit"
            color="primary"
            loading={loading}
          >
            {i18n.t("transferTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TransferTicketModalCustom;
