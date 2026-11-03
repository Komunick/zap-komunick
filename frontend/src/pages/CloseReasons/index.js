import React, { useCallback, useContext, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Switch from "@material-ui/core/Switch";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddIcon from "@material-ui/icons/Add";
import { Alert } from "@material-ui/lab";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

// Zap Komunick: close reasons (docs/PRD.md, RF-007)

const REPORT_DAYS = 30;

const useStyles = makeStyles(theme => ({
  content: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles
  },
  hint: {
    marginBottom: theme.spacing(2)
  },
  usage: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 140
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.komunick.subtle,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.palette.primary.main
  },
  inactive: {
    color: theme.palette.text.disabled
  },
  centered: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4)
  }
}));

const CloseReasonDialog = ({ open, reason, onClose, onSaved }) => {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(reason?.name || "");
    }
  }, [open, reason]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (reason?.id) {
        await api.put(`/close-reasons/${reason.id}`, { name });
      } else {
        await api.post("/close-reasons", { name });
      }
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {reason?.id
          ? i18n.t("closeReasons.dialog.editTitle")
          : i18n.t("closeReasons.dialog.addTitle")}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          variant="outlined"
          margin="dense"
          label={i18n.t("closeReasons.dialog.name")}
          value={name}
          onChange={e => setName(e.target.value)}
          inputProps={{ maxLength: 120 }}
          onKeyDown={e => {
            if (e.key === "Enter" && name.trim().length >= 2) {
              handleSave();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("closeReasons.dialog.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving || name.trim().length < 2}
        >
          {i18n.t("closeReasons.dialog.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CloseReasons = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";
  const [reasons, setReasons] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: list }, { data: report }] = await Promise.all([
        api.get("/close-reasons", { params: { all: true } }),
        api.get("/close-reasons/report", { params: { days: REPORT_DAYS } })
      ]);
      setReasons(list);
      const counts = {};
      (report?.rows || []).forEach(row => {
        counts[row.closeReasonId || "none"] = row.count;
      });
      setUsage(counts);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin, load]);

  const handleToggle = async reason => {
    try {
      await api.put(`/close-reasons/${reason.id}`, {
        active: !reason.active
      });
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/close-reasons/${deleting.id}`);
      load();
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  const total = Object.values(usage).reduce((sum, count) => sum + count, 0);

  if (!isAdmin) {
    return (
      <MainContainer>
        <Alert severity="warning">{i18n.t("closeReasons.onlyAdmin")}</Alert>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <CloseReasonDialog
        open={dialogOpen}
        reason={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
      <ConfirmationModal
        title={i18n.t("closeReasons.confirmDelete.title", {
          name: deleting?.name || ""
        })}
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      >
        {i18n.t("closeReasons.confirmDelete.message")}
      </ConfirmationModal>
      <MainHeader>
        <Title>{i18n.t("closeReasons.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            {i18n.t("closeReasons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.content} variant="outlined">
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.hint}
        >
          {i18n.t("closeReasons.hint", { days: REPORT_DAYS })}
        </Typography>
        {loading ? (
          <div className={classes.centered}>
            <CircularProgress size={28} />
          </div>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("closeReasons.table.name")}</TableCell>
                <TableCell>
                  {i18n.t("closeReasons.table.usage", { days: REPORT_DAYS })}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("closeReasons.table.active")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("closeReasons.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reasons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    {i18n.t("closeReasons.empty")}
                  </TableCell>
                </TableRow>
              )}
              {reasons.map(reason => {
                const count = usage[reason.id] || 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                return (
                  <TableRow key={reason.id}>
                    <TableCell
                      className={reason.active ? undefined : classes.inactive}
                    >
                      {reason.name}
                    </TableCell>
                    <TableCell>
                      <div className={classes.usage}>
                        <div className={classes.bar}>
                          <div
                            className={classes.barFill}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <Typography variant="body2">{count}</Typography>
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        color="primary"
                        checked={reason.active}
                        onChange={() => handleToggle(reason)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={i18n.t("closeReasons.edit")}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditing(reason);
                            setDialogOpen(true);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={i18n.t("closeReasons.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => setDeleting(reason)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {usage.none > 0 && (
                <TableRow>
                  <TableCell className={classes.inactive}>
                    {i18n.t("closeReasons.withoutReason")}
                  </TableCell>
                  <TableCell>
                    <div className={classes.usage}>
                      <div className={classes.bar}>
                        <div
                          className={classes.barFill}
                          style={{
                            width: `${Math.round((usage.none / total) * 100)}%`,
                            opacity: 0.4
                          }}
                        />
                      </div>
                      <Typography variant="body2">{usage.none}</Typography>
                    </div>
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default CloseReasons;
