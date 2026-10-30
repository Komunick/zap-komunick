import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { useParams, useHistory } from "react-router-dom";

import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  makeStyles,
  Paper,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import GroupIcon from "@material-ui/icons/Group";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";

import ChatList from "./ChatList";
import ChatMessages from "./ChatMessages";
import { UsersFilter } from "../../components/UsersFilter";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import {
  chatDisplayName,
  chatPeerId,
  mergeChat,
  mergeChatMessages
} from "../../helpers/chatDisplay";

// Zap Komunick: the internal chat is one list of conversations (groups and
// one-to-one) plus the people of the company; see docs/PRD.md, RF-010.

const useStyles = makeStyles(theme => ({
  page: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    padding: "8px 16px 16px",
    [theme.breakpoints.down("sm")]: { padding: 0 }
  },
  shell: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper
  },
  aside: {
    display: "flex",
    flexDirection: "column",
    flex: "none",
    width: 320,
    minHeight: 0,
    borderRight: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("sm")]: { width: "100%", borderRight: 0 }
  },
  asideHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "14px 12px 10px 16px"
  },
  asideTitle: { fontSize: 18, fontWeight: 700 },
  asideSubtitle: { color: theme.komunick.textSecondary, fontSize: 12 },
  conversation: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    minHeight: 0
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    borderBottom: `1px solid ${theme.komunick.border}`,
    backgroundColor: theme.komunick.paper
  },
  headAvatar: { width: 40, height: 40, fontWeight: 700, color: "#FFFFFF" },
  headText: { flex: 1, minWidth: 0 },
  headName: { fontSize: 16, fontWeight: 700 },
  headSub: { fontSize: 13, color: theme.palette.text.secondary },
  messages: { flex: 1, minHeight: 0, display: "flex" },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    textAlign: "center",
    color: theme.palette.text.secondary
  },
  emptyIcon: { fontSize: 48, opacity: 0.5 }
}));

export function ChatModal({
  open,
  chat,
  type,
  handleClose,
  handleLoadNewChat,
  user
}) {
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setTitle("");
    setUsers([]);
    if (type === "edit" && chat?.users) {
      const userList = chat.users.map(u => ({
        id: u.user.id,
        name: u.user.name
      }));
      setUsers(userList);
      setTitle(chat.title);
    }
  }, [chat, open, type]);

  const handleSave = async () => {
    try {
      if (!title) {
        alert(i18n.t("chatPage.needTitle"));
        return;
      }

      if (!users || users.length === 0) {
        alert(i18n.t("chatPage.needUsers"));
        return;
      }

      if (type === "edit") {
        await api.put(`/chats/${chat.id}`, {
          users,
          title
        });
      } else {
        const { data } = await api.post("/chats", {
          users,
          title
        });
        handleLoadNewChat(data);
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {type === "edit"
          ? i18n.t("chatPage.editGroup")
          : i18n.t("chatPage.newGroup")}
      </DialogTitle>
      <DialogContent>
        <Grid spacing={2} container>
          <Grid xs={12} style={{ padding: 18 }} item>
            <TextField
              label={i18n.t("chatPage.groupName")}
              placeholder={i18n.t("chatPage.groupName")}
              value={title}
              onChange={e => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid xs={12} item>
            <UsersFilter
              multiple
              onFiltered={users => setUsers(users)}
              initialUsers={users}
              excludeId={user.id}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {i18n.t("chatPage.close")}
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {i18n.t("chatPage.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Chat(props) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("new");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [chats, setChats] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [openingContact, setOpeningContact] = useState(null);
  const scrollToBottomRef = useRef();
  const currentIdRef = useRef(null);
  const messagesRequestRef = useRef(0);
  const pendingRequestRef = useRef(null);
  const messagesPageRef = useRef(1);
  const paginationReadyRef = useRef(false);
  const retryMessagesRef = useRef({ page: 1, refresh: false });
  const navigationRef = useRef(0);
  const openingContactRef = useRef(false);
  const mountedRef = useRef(true);
  const pendingListChangesRef = useRef(null);
  const { id } = useParams();
  const routeIdRef = useRef(id);
  routeIdRef.current = id;

  const socketManager = useContext(SocketContext);
  const wide = isWidthUp("md", props.width);

  const currentChat = useMemo(
    () => chats.find(chat => chat.id === currentId) || {},
    [chats, currentId]
  );
  const hasChat = currentChat.id !== undefined;

  const usersById = useMemo(() => {
    const map = {};
    contacts.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [contacts]);

  const upsertChat = record => {
    if (!record) return;
    const changes = pendingListChangesRef.current;
    if (changes)
      changes.set(record.id, mergeChat(changes.get(record.id), record));
    setChats(prev =>
      prev.some(chat => chat.id === record.id)
        ? prev.map(chat =>
            chat.id === record.id ? mergeChat(chat, record) : chat
          )
        : [record, ...prev]
    );
  };

  useEffect(() => {
    let active = true;
    const changes = new Map();
    pendingListChangesRef.current = changes;
    setListLoading(true);
    setListError(false);
    let pending = 2;
    const finished = () => {
      pending -= 1;
      if (active && pending === 0) setListLoading(false);
    };
    const loadChats = async () => {
      let all = [];
      let page = 1;
      let more = true;
      while (more && active) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await api.get("/chats", {
          params: { pageNumber: page }
        });
        all = [...all, ...data.records];
        more = data.hasMore;
        page += 1;
      }
      return all;
    };
    loadChats()
      .then(all => {
        if (!active) return;
        // Zap Komunick: a delayed list snapshot must not undo a newer direct
        // creation, socket update or deletion that happened while it loaded.
        const reconciled = new Map(all.map(chat => [chat.id, chat]));
        changes.forEach((record, chatId) => {
          if (record === null) reconciled.delete(chatId);
          else
            reconciled.set(chatId, mergeChat(reconciled.get(chatId), record));
        });
        const records = Array.from(reconciled.values());
        setChats(records);
        if (routeIdRef.current && !currentIdRef.current) {
          const chat = records.find(c => c.uuid === routeIdRef.current);
          if (chat) selectChat(chat, false);
        }
      })
      .catch(() => {
        if (active) setListError(true);
      })
      .finally(() => {
        if (pendingListChangesRef.current === changes)
          pendingListChangesRef.current = null;
        finished();
      });
    api
      .get("/users/list")
      .then(({ data }) => {
        if (active) setContacts(data);
      })
      .catch(() => {
        if (active) setListError(true);
      })
      .finally(finished);
    return () => {
      active = false;
      if (pendingListChangesRef.current === changes)
        pendingListChangesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      messagesRequestRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (currentId) {
      findMessages(currentId, 1).then(() => {
        if (
          currentIdRef.current === currentId &&
          typeof scrollToBottomRef.current === "function"
        ) {
          setTimeout(() => {
            if (currentIdRef.current === currentId)
              scrollToBottomRef.current?.();
          }, 300);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);

    const onChatUser = data => {
      if (data.action === "create" || data.action === "update") {
        upsertChat(data.record);
      }
    };

    const onChat = data => {
      if (data.action === "delete") {
        pendingListChangesRef.current?.set(+data.id, null);
        setChats(prev => prev.filter(c => c.id !== +data.id));
        if (currentIdRef.current === +data.id) {
          setCurrentId(null);
          currentIdRef.current = null;
          navigationRef.current += 1;
          messagesRequestRef.current += 1;
          pendingRequestRef.current = null;
          setMessages([]);
          history.push("/chats");
        }
      }

      if (data.action === "new-message" || data.action === "update") {
        upsertChat(data.chat);
        const mine = data.newMessage?.senderId === user.id;
        if (
          data.action === "new-message" &&
          !mine &&
          data.chat.id === currentIdRef.current
        ) {
          api
            .post(`/chats/${data.chat.id}/read`, { userId: user.id })
            .catch(toastError);
        }
      }
    };

    const onMessage = data => {
      if (
        data.action === "new-message" &&
        currentId === currentIdRef.current &&
        data.newMessage?.chatId === currentIdRef.current
      ) {
        setMessages(prev => mergeChatMessages(prev, [data.newMessage]));
        if (typeof scrollToBottomRef.current === "function") {
          scrollToBottomRef.current();
        }
      }
    };

    socket.on(`company-${companyId}-chat-user-${user.id}`, onChatUser);
    socket.on(`company-${companyId}-chat`, onChat);
    if (currentId) {
      socket.on(`company-${companyId}-chat-${currentId}`, onMessage);
    }

    return () => {
      socket.off(`company-${companyId}-chat-user-${user.id}`, onChatUser);
      socket.off(`company-${companyId}-chat`, onChat);
      if (currentId) {
        socket.off(`company-${companyId}-chat-${currentId}`, onMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, socketManager, user.id]);

  const selectChat = (chat, navigate = true) => {
    if (currentIdRef.current === chat.id) return;
    currentIdRef.current = chat.id;
    navigationRef.current += 1;
    messagesRequestRef.current += 1;
    pendingRequestRef.current = null;
    retryMessagesRef.current = { page: 1, refresh: false };
    setMessages([]);
    messagesPageRef.current = 1;
    paginationReadyRef.current = false;
    setMessagesPageInfo({ hasMore: false });
    setMessagesError(false);
    setMessagesLoading(true);
    setCurrentId(chat.id);
    if (navigate && chat.uuid !== id) history.push(`/chats/${chat.uuid}`);
    const unreads =
      (chat.users || []).find(u => u.userId === user.id)?.unreads || 0;
    if (unreads > 0) {
      api.post(`/chats/${chat.id}/read`, { userId: user.id }).catch(toastError);
    }
  };

  const selectContact = async person => {
    if (openingContactRef.current) return;
    openingContactRef.current = true;
    const navigation = navigationRef.current;
    setOpeningContact(person.id);
    try {
      const { data } = await api.post("/chats/direct", { userId: person.id });
      if (!mountedRef.current) return;
      upsertChat(data);
      if (navigationRef.current === navigation) {
        selectChat(data);
        setSearch("");
      }
    } catch (err) {
      toastError(err);
    } finally {
      openingContactRef.current = false;
      if (mountedRef.current) setOpeningContact(null);
    }
  };

  const backToList = () => {
    currentIdRef.current = null;
    navigationRef.current += 1;
    messagesRequestRef.current += 1;
    pendingRequestRef.current = null;
    setCurrentId(null);
    setMessages([]);
    history.push("/chats");
  };

  const sendMessage = async contentMessage => {
    const chatId = currentId;
    if (!chatId || currentIdRef.current !== chatId) return false;
    try {
      const { data } = await api.post(`/chats/${chatId}/messages`, {
        message: contentMessage
      });
      if (mountedRef.current && currentIdRef.current === chatId) {
        setMessages(prev => mergeChatMessages(prev, [data]));
        scrollToBottomRef.current?.();
      }
      return true;
    } catch {
      return false;
    }
  };

  const deleteChat = async () => {
    try {
      await api.delete(`/chats/${currentChat.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const findMessages = async (
    chatId,
    page = messagesPageRef.current,
    refresh = false
  ) => {
    if (
      !chatId ||
      currentIdRef.current !== chatId ||
      (pendingRequestRef.current && !refresh)
    )
      return false;
    const request = ++messagesRequestRef.current;
    pendingRequestRef.current = request;
    retryMessagesRef.current = { page, refresh };
    setMessagesLoading(true);
    setMessagesError(false);
    try {
      const { data } = await api.get(
        `/chats/${chatId}/messages?pageNumber=${page}`
      );
      if (
        !mountedRef.current ||
        currentIdRef.current !== chatId ||
        messagesRequestRef.current !== request
      )
        return false;
      if (!refresh || !paginationReadyRef.current) {
        messagesPageRef.current = page + 1;
        paginationReadyRef.current = true;
        setMessagesPageInfo({ hasMore: data.hasMore });
      }
      setMessages(prev => mergeChatMessages(prev, data.records));
      return true;
    } catch {
      if (
        mountedRef.current &&
        currentIdRef.current === chatId &&
        messagesRequestRef.current === request
      )
        setMessagesError(true);
      return false;
    } finally {
      if (
        mountedRef.current &&
        currentIdRef.current === chatId &&
        messagesRequestRef.current === request
      ) {
        pendingRequestRef.current = null;
        setMessagesLoading(false);
      }
    }
  };

  const loadMoreMessages = async () => {
    if (!messagesLoading) {
      findMessages(currentId);
    }
  };

  const renderHeader = () => {
    const name = chatDisplayName(currentChat, user.id, usersById);
    const peer = usersById[chatPeerId(currentChat, user.id)];
    const members = (currentChat.users || [])
      .map(u => u.user?.name || usersById[u.userId]?.name)
      .filter(Boolean);
    const subtitle = currentChat.isDirect
      ? peer?.email
      : members.length > 4
        ? `${members.slice(0, 4).join(", ")} +${members.length - 4}`
        : members.join(", ");
    const canManage = !currentChat.isDirect && currentChat.ownerId === user.id;

    return (
      <div className={classes.head}>
        {!wide && (
          <IconButton
            size="small"
            onClick={backToList}
            aria-label={i18n.t("chatPage.back")}
          >
            <ArrowBackIcon />
          </IconButton>
        )}
        <Avatar
          className={classes.headAvatar}
          style={{ backgroundColor: generateColor(name) }}
        >
          {currentChat.isDirect ? getInitials(name) : <GroupIcon />}
        </Avatar>
        <div className={classes.headText}>
          <Typography noWrap className={classes.headName}>
            {name}
          </Typography>
          <Typography noWrap className={classes.headSub}>
            {subtitle}
          </Typography>
        </div>
        {canManage && (
          <>
            <Tooltip title={i18n.t("chatPage.editGroup")}>
              <IconButton
                size="small"
                aria-label={i18n.t("chatPage.editGroup")}
                onClick={() => {
                  setDialogType("edit");
                  setShowDialog(true);
                }}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={i18n.t("chatPage.deleteGroup")}>
              <IconButton
                size="small"
                aria-label={i18n.t("chatPage.deleteGroup")}
                onClick={() => setConfirmDelete(true)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <ChatModal
        type={dialogType}
        open={showDialog}
        chat={currentChat}
        handleLoadNewChat={data => {
          upsertChat(data);
          selectChat(data);
        }}
        handleClose={() => setShowDialog(false)}
        user={user}
      />
      <ConfirmationModal
        title={i18n.t("chatPage.deleteGroup")}
        open={confirmDelete}
        onClose={setConfirmDelete}
        onConfirm={deleteChat}
      >
        {i18n.t("chatPage.deleteWarning")}
      </ConfirmationModal>
      <div className={classes.page}>
        <Title>{i18n.t("internalChat.title")}</Title>
        <Paper elevation={0} className={classes.shell}>
          {(wide || !hasChat) && (
            <aside
              className={classes.aside}
              aria-label={i18n.t("chatPage.teamConversations")}
            >
              <div className={classes.asideHead}>
                <div>
                  <Typography className={classes.asideTitle}>
                    {i18n.t("chatPage.people")}
                  </Typography>
                  <Typography className={classes.asideSubtitle}>
                    {i18n.t("chatPage.teamHint")}
                  </Typography>
                </div>
                <Button
                  size="small"
                  color="primary"
                  variant="outlined"
                  startIcon={<GroupAddIcon />}
                  onClick={() => {
                    setDialogType("new");
                    setShowDialog(true);
                  }}
                >
                  {i18n.t("chatPage.newGroup")}
                </Button>
              </div>
              <ChatList
                chats={chats}
                contacts={contacts}
                user={user}
                search={search}
                onSearch={setSearch}
                activeUuid={currentChat.uuid}
                onSelectChat={chat => selectChat(chat)}
                onSelectContact={selectContact}
                loading={listLoading}
                error={listError}
                onRetry={() => setListVersion(version => version + 1)}
                openingContact={openingContact}
              />
            </aside>
          )}
          {(wide || hasChat) && (
            <section className={classes.conversation}>
              {hasChat ? (
                <>
                  {renderHeader()}
                  <div className={classes.messages}>
                    <ChatMessages
                      key={currentChat.id}
                      chat={currentChat}
                      scrollToBottomRef={scrollToBottomRef}
                      pageInfo={messagesPageInfo}
                      messages={messages}
                      historyLoading={messagesLoading}
                      historyError={messagesError}
                      handleRetryMessages={() =>
                        findMessages(
                          currentId,
                          retryMessagesRef.current.page,
                          retryMessagesRef.current.refresh
                        )
                      }
                      handleMediaSent={() => findMessages(currentId, 1, true)}
                      handleSendMessage={sendMessage}
                      handleLoadMore={loadMoreMessages}
                    />
                  </div>
                </>
              ) : (
                <div className={classes.empty}>
                  <ForumOutlinedIcon className={classes.emptyIcon} />
                  <Typography variant="subtitle1">
                    {i18n.t("chatPage.pick")}
                  </Typography>
                  <Typography variant="body2">
                    {i18n.t("chatPage.pickHint")}
                  </Typography>
                </div>
              )}
            </section>
          )}
        </Paper>
      </div>
    </>
  );
}

export default withWidth()(Chat);
