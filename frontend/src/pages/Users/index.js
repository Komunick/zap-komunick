import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";
import Tooltip from "@material-ui/core/Tooltip";
import { Alert } from "@material-ui/lab";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import LockOpenOutlinedIcon from "@material-ui/icons/LockOpenOutlined";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  // Zap Komunick: reset only the security flag, preserving current list data.
  if (action.type === "RESET_TWO_FACTOR") {
    return state.map(user =>
      user.id === action.payload ? { ...user, twoFactorEnabled: false } : user
    );
  }

  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach(user => {
      const userIndex = state.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex(u => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles
  }
}));

const Users = () => {
  const classes = useStyles();
  const { user: currentUser } = useContext(AuthContext);
  const isAdmin = currentUser?.profile === "admin";

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber }
          });
          dispatch({ type: "LOAD_USERS", payload: data.users });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);

    const onCompanyUser = data => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    };

    socket.on(`company-${companyId}-user`, onCompanyUser);

    return () => {
      socket.disconnect();
    };
  }, [socketManager]);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = event => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = user => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async userId => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  // Zap Komunick: administrators can help another user who lost their 2FA.
  // Disabling one's own 2FA belongs to Account Security (password + code).
  const handleResetTwoFactor = async () => {
    if (!resetTarget || resetting || resetTarget.id === currentUser?.id) return;
    setResetting(true);
    setResetError("");
    try {
      await api.delete(`/users/${resetTarget.id}/2fa`);
      dispatch({ type: "RESET_TWO_FACTOR", payload: resetTarget.id });
      toast.success(i18n.t("usersTwoFactor.resetDone"));
      setResetTarget(null);
    } catch (err) {
      const key = `backendErrors.${err.response?.data?.error}`;
      setResetError(
        i18n.exists(key) ? i18n.t(key) : i18n.t("usersTwoFactor.resetError")
      );
    } finally {
      setResetting(false);
    }
  };

  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };

  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <Dialog
        open={!!resetTarget}
        onClose={() => {
          if (!resetting) setResetTarget(null);
        }}
        maxWidth="xs"
        fullWidth
        aria-labelledby="reset-two-factor-title"
        aria-describedby="reset-two-factor-description"
      >
        <DialogTitle id="reset-two-factor-title">
          {i18n.t("usersTwoFactor.resetTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-two-factor-description">
            {i18n.t("usersTwoFactor.resetMessage", {
              name: resetTarget?.name || ""
            })}
          </DialogContentText>
          {resetError && <Alert severity="error">{resetError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={resetting} onClick={() => setResetTarget(null)}>
            {i18n.t("usersTwoFactor.cancel")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={resetting}
            onClick={handleResetTwoFactor}
            startIcon={
              resetting ? <CircularProgress color="inherit" size={16} /> : null
            }
          >
            {i18n.t(
              resetting ? "usersTwoFactor.resetting" : "usersTwoFactor.confirm"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${
            deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
      />
      <MainHeader>
        <Title>{i18n.t("users.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenUserModal}
          >
            {i18n.t("users.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">ID</TableCell>
              <TableCell align="center">{i18n.t("users.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("users.table.email")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.profile")}
              </TableCell>
              {isAdmin && (
                <TableCell align="center">
                  {i18n.t("usersTwoFactor.column")}
                </TableCell>
              )}
              <TableCell align="center">
                {i18n.t("users.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell align="center">{user.id}</TableCell>
                  <TableCell align="center">{user.name}</TableCell>
                  <TableCell align="center">{user.email}</TableCell>
                  <TableCell align="center">{user.profile}</TableCell>
                  {isAdmin && (
                    <TableCell align="center">
                      <Chip
                        size="small"
                        variant="outlined"
                        color={user.twoFactorEnabled ? "primary" : "default"}
                        label={i18n.t(
                          typeof user.twoFactorEnabled !== "boolean"
                            ? "usersTwoFactor.unknown"
                            : user.twoFactorEnabled
                              ? "usersTwoFactor.enabled"
                              : "usersTwoFactor.disabled"
                        )}
                      />
                    </TableCell>
                  )}
                  <TableCell align="center">
                    {isAdmin &&
                      user.twoFactorEnabled &&
                      user.id !== currentUser.id &&
                      (!user.super || currentUser.super) && (
                        <Tooltip title={i18n.t("usersTwoFactor.reset")}>
                          <IconButton
                            size="small"
                            aria-label={i18n.t("usersTwoFactor.resetFor", {
                              name: user.name
                            })}
                            onClick={() => {
                              setResetError("");
                              setResetTarget(user);
                            }}
                          >
                            <LockOpenOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={e => {
                        setConfirmModalOpen(true);
                        setDeletingUser(user);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={isAdmin ? 6 : 5} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Users;
