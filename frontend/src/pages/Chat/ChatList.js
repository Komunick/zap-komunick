import React, { useMemo, useRef } from "react";
import {
  Avatar,
  Button,
  CircularProgress,
  IconButton,
  InputBase,
  makeStyles,
  Typography
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import GroupIcon from "@material-ui/icons/Group";
import ClearIcon from "@material-ui/icons/Clear";
import clsx from "clsx";
import { parseISO } from "date-fns";

import { i18n } from "../../translate/i18n";
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import { chatDisplayName, chatPeerId } from "../../helpers/chatDisplay";
import pastRelativeDate from "../../helpers/pastRelativeDate";

// Zap Komunick: one list that mixes the conversations (groups and one-to-one,
// most recent first) with the people of the company that have no conversation
// yet. Clicking a person opens, or creates, the conversation with them.

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flex: 1
  },
  search: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "0 12px 8px",
    padding: "6px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.komunick.subtle,
    color: theme.palette.text.secondary,
    "&:focus-within": { borderColor: theme.komunick.accent }
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.palette.text.primary },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "0 6px 12px",
    ...theme.scrollbarStyles
  },
  section: {
    padding: "12px 10px 4px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "9px 10px",
    border: "1px solid transparent",
    borderRadius: 12,
    background: "none",
    textAlign: "left",
    font: "inherit",
    color: theme.palette.text.primary,
    cursor: "pointer",
    "&:hover": { backgroundColor: theme.komunick.subtle },
    "&:disabled": { cursor: "wait", opacity: 0.65 },
    "&:focus-visible": { outline: `2px solid ${theme.komunick.accent}` }
  },
  rowActive: {
    borderColor: theme.komunick.accent,
    backgroundColor: theme.komunick.selectedRow
  },
  avatar: {
    width: 40,
    height: 40,
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF"
  },
  body: { flex: 1, minWidth: 0 },
  top: { display: "flex", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: 700 },
  time: { flex: "none", fontSize: 12, color: theme.palette.text.secondary },
  sub: { fontSize: 13, fontWeight: 400, color: theme.palette.text.secondary },
  unread: {
    flex: "none",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "20px",
    textAlign: "center",
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main
  },
  empty: {
    padding: "24px 16px",
    fontSize: 14,
    textAlign: "center",
    color: theme.palette.text.secondary,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}));

const normalize = text =>
  (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ChatList({
  chats,
  contacts,
  user,
  search,
  onSearch,
  activeUuid,
  onSelectChat,
  onSelectContact,
  loading = false,
  error = false,
  onRetry,
  openingContact
}) {
  const classes = useStyles();
  const searchRef = useRef();
  const activePeer = chatPeerId(
    chats.find(chat => chat.uuid === activeUuid),
    user.id
  );

  const usersById = useMemo(() => {
    const map = {};
    contacts.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [contacts]);

  const { conversations, people } = useMemo(() => {
    const term = normalize(search.trim());
    const matches = (...texts) =>
      !term || texts.some(text => normalize(text).includes(term));

    // a one-to-one conversation nobody wrote in yet is just a contact
    const conversations = chats
      .filter(chat => !chat.isDirect || chat.lastMessage)
      .map(chat => ({
        chat,
        name: chatDisplayName(chat, user.id, usersById),
        peer: usersById[chatPeerId(chat, user.id)]
      }))
      .filter(item =>
        matches(item.name, item.peer?.email, item.chat.lastMessage)
      )
      .sort((a, b) => new Date(b.chat.updatedAt) - new Date(a.chat.updatedAt));

    const talking = new Set(
      conversations.filter(i => i.chat.isDirect).map(i => i.peer?.id)
    );
    const people = contacts
      .filter(c => c.id !== user.id && !talking.has(c.id))
      .filter(c => matches(c.name, c.email))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { conversations, people };
  }, [chats, contacts, search, user.id, usersById]);

  const unreadsOf = chat =>
    (chat.users || []).find(u => u.userId === user.id)?.unreads || 0;

  const nothing = conversations.length === 0 && people.length === 0;

  return (
    <div className={classes.root}>
      <div className={classes.search}>
        <SearchIcon fontSize="small" />
        <InputBase
          className={classes.searchInput}
          inputRef={searchRef}
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={i18n.t("chatPage.search")}
          inputProps={{ "aria-label": i18n.t("chatPage.search") }}
        />
        {search && (
          <IconButton
            size="small"
            aria-label={i18n.t("chatPage.clearSearch")}
            onClick={() => {
              onSearch("");
              searchRef.current?.focus();
            }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <div className={classes.scroll} aria-busy={loading}>
        {loading && (
          <div className={classes.empty} role="status">
            <CircularProgress size={22} />
            {i18n.t("chatPage.loadingConversations")}
          </div>
        )}
        {error && (
          <div className={classes.empty} role="alert">
            <Typography variant="body2">
              {i18n.t("chatPage.conversationsError")}
            </Typography>
            <Button size="small" onClick={onRetry}>
              {i18n.t("chatPage.retry")}
            </Button>
          </div>
        )}
        {conversations.length > 0 && (
          <div className={classes.section}>
            {i18n.t("chatPage.conversations")}
          </div>
        )}
        {conversations.map(({ chat, name }) => {
          const unreads = unreadsOf(chat);
          return (
            <button
              type="button"
              key={`chat-${chat.id}`}
              className={clsx(
                classes.row,
                chat.uuid === activeUuid && classes.rowActive
              )}
              onClick={() => onSelectChat(chat)}
              aria-pressed={chat.uuid === activeUuid}
            >
              <Avatar
                className={classes.avatar}
                style={{ backgroundColor: generateColor(name) }}
              >
                {chat.isDirect ? getInitials(name) : <GroupIcon />}
              </Avatar>
              <div className={classes.body}>
                <div className={classes.top}>
                  <Typography noWrap className={classes.name}>
                    {name}
                  </Typography>
                  {chat.updatedAt && (
                    <span className={classes.time}>
                      {pastRelativeDate(parseISO(chat.updatedAt))}
                    </span>
                  )}
                </div>
                <div className={classes.top}>
                  <Typography
                    noWrap
                    className={clsx(classes.sub, classes.name)}
                  >
                    {chat.lastMessage || i18n.t("chatPage.emptyPreview")}
                  </Typography>
                  {unreads > 0 && (
                    <span
                      className={classes.unread}
                      aria-label={i18n.t("chatPage.unreadMessages", {
                        count: unreads
                      })}
                    >
                      {unreads}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {people.length > 0 && (
          <div className={classes.section}>{i18n.t("chatPage.contacts")}</div>
        )}
        {people.map(person => (
          <button
            type="button"
            key={`user-${person.id}`}
            className={clsx(
              classes.row,
              activePeer === person.id && classes.rowActive
            )}
            aria-pressed={activePeer === person.id}
            onClick={() => onSelectContact(person)}
            disabled={!!openingContact}
            aria-busy={openingContact === person.id}
          >
            <Avatar
              className={classes.avatar}
              style={{ backgroundColor: generateColor(person.name) }}
            >
              {getInitials(person.name)}
            </Avatar>
            <div className={classes.body}>
              <Typography noWrap className={classes.name}>
                {person.name}
              </Typography>
              <Typography noWrap className={classes.sub}>
                {person.email}
              </Typography>
            </div>
          </button>
        ))}

        {nothing && !loading && !error && (
          <div className={classes.empty} role="status">
            {i18n.t(search.trim() ? "chatPage.noResults" : "chatPage.nobody")}
            <Typography variant="body2">
              {i18n.t(
                search.trim() ? "chatPage.searchHint" : "chatPage.emptyTeamHint"
              )}
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
