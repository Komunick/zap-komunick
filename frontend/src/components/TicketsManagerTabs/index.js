import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";

import { alpha, makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import { Box, Button } from "@material-ui/core";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import useSettings from "../../hooks/useSettings";
import { ContactSelect } from "../ContactSelect";

const useStyles = makeStyles(theme => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0
  },

  tabsHeader: {
    flex: "none",
    // Zap Komunick: segmented pills
    padding: 6,
    borderBottom: `1px solid ${theme.palette.divider}`,
    "& .MuiTabs-indicator": {
      display: "none"
    },
    "& .MuiTab-root": {
      minHeight: 40,
      borderRadius: 10,
      color: theme.palette.text.secondary
    },
    "& .MuiTab-wrapper": {
      flexDirection: "row",
      gap: 6
    },
    "& .MuiTab-labelIcon .MuiTab-wrapper > *:first-child": {
      marginBottom: 0,
      fontSize: 20
    },
    "& .Mui-selected": {
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.1)
    }
  },

  statusTabs: {
    margin: theme.spacing(0, 1),
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: theme.komunick.subtle,
    border: `1px solid ${theme.palette.divider}`,
    "& .MuiTabs-indicator": {
      display: "none"
    },
    "& .MuiTab-root": {
      minHeight: 36,
      margin: 2,
      borderRadius: 10,
      color: theme.palette.text.secondary
    },
    "& .Mui-selected": {
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.komunick.shadow
    }
  },

  // Zap Komunick: one row of views (Meus, Aguardando, Pausados, Resolvidos)
  visions: {
    flex: "none",
    minHeight: 44,
    padding: "0 8px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    "& .MuiTab-root": {
      minWidth: 0,
      minHeight: 44,
      padding: "6px 12px",
      textTransform: "none",
      fontWeight: 600,
      fontSize: 14,
      color: theme.palette.text.secondary
    },
    "& .Mui-selected": {
      color: theme.palette.text.primary
    },
    "& .MuiTabs-indicator": {
      height: 2,
      backgroundColor: theme.komunick.accent
    }
  },
  visionSearch: {
    minWidth: 44,
    marginLeft: "auto"
  },
  count: {
    marginLeft: 6,
    minWidth: 20,
    padding: "1px 6px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "16px",
    textAlign: "center",
    color: theme.palette.text.secondary,
    backgroundColor: theme.komunick.tagBackground
  },
  countHot: {
    color: "#FFFFFF",
    backgroundColor: theme.palette.primary.main
  },
  queueRow: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 12px 8px",
    overflowX: "auto",
    "&::-webkit-scrollbar": { height: 0 }
  },
  queueLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginRight: 2
  },
  queueChip: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 26,
    padding: "0 10px",
    borderRadius: 13,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    color: theme.palette.text.secondary,
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    "&:hover": {
      borderColor: theme.komunick.borderStrong
    }
  },
  queueChipOn: {
    color: theme.palette.text.primary,
    borderColor: theme.komunick.accent,
    backgroundColor: theme.komunick.selectedRow
  },
  queueDot: {
    width: 8,
    height: 8,
    borderRadius: "50%"
  },
  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: 8
  },

  tabWithGroups: {
    minWidth: 72
  },

  tab: {
    minWidth: 90
  },

  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    // background: "#fafafa",
    padding: theme.spacing(1)
  },

  serachInputWrapper: {
    flex: 1,
    // background: "#fff",
    display: "flex",
    borderRadius: 40,
    padding: 4,
    marginRight: theme.spacing(1)
  },

  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center"
  },

  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30
  },

  // Zap Komunick: the count sits after the label, not over its last letters
  badge: {
    alignItems: "center",
    "& .MuiBadge-badge": {
      position: "static",
      transform: "none",
      marginLeft: 8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      fontWeight: 700
    },
    "& .MuiBadge-invisible": {
      display: "none"
    }
  },
  show: {
    display: "block"
  },
  hide: {
    display: "none !important"
  },

  icon24: {
    width: 24,
    height: 24
  }
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { profile } = user;

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = user.queues.map(q => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const { getSetting } = useSettings();
  const [showTabGroups, setShowTabGroups] = useState(false);

  useEffect(() => {
    Promise.all([getSetting("CheckMsgIsGroup"), getSetting("groupsTab")]).then(
      ([ignoreGroups, groupsTab]) => {
        setShowTabGroups(
          ignoreGroups === "disabled" && groupsTab === "enabled"
        );
      }
    );
  }, []);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = e => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const view = tab === "open" ? (tabOpen === "open" ? "mine" : "waiting") : tab;

  const handleChangeView = (e, newValue) => {
    if (newValue === "mine" || newValue === "waiting") {
      setTab("open");
      setTabOpen(newValue === "mine" ? "open" : "pending");
      return;
    }
    handleChangeTab(e, newValue);
  };

  const toggleQueue = queueId => {
    setSelectedQueueIds(current => {
      if (current.includes(queueId)) {
        return current.length > 1 ? current.filter(id => id !== queueId) : current;
      }
      return [...current, queueId];
    });
  };

  const visionLabel = (text, count, hot) => (
    <span>
      {text}
      {count !== undefined && count > 0 && (
        <span className={clsx(classes.count, hot && classes.countHot)}>
          {count > 999 ? "999+" : count}
        </span>
      )}
    </span>
  );

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = status => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseOrOpenTicket = ticket => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = selecteds => {
    const tags = selecteds.map(t => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = selecteds => {
    const users = selecteds.map(t => t.id);
    setSelectedUsers(users);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={ticket => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <Tabs
        value={view}
        onChange={handleChangeView}
        variant="scrollable"
        scrollButtons="off"
        indicatorColor="primary"
        textColor="primary"
        className={classes.visions}
        aria-label={i18n.t("tickets.views.label")}
      >
        <Tab
          value="mine"
          label={visionLabel(
            showAllTickets
              ? i18n.t("tickets.views.inService")
              : i18n.t("tickets.views.mine"),
            openCount
          )}
        />
        <Tab
          value="waiting"
          label={visionLabel(
            i18n.t("tickets.views.waiting"),
            pendingCount,
            true
          )}
        />
        <Tab value="paused" label={i18n.t("tickets.tabs.paused.title")} />
        {showTabGroups && (
          <Tab value="groups" label={i18n.t("tickets.tabs.groups.title")} />
        )}
        <Tab value="closed" label={i18n.t("tickets.tabs.closed.title")} />
        <Tab
          value="search"
          className={classes.visionSearch}
          icon={<SearchIcon fontSize="small" />}
          aria-label={i18n.t("tickets.tabs.search.title")}
        />
      </Tabs>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setNewTicketModalOpen(true)}
            >
              {i18n.t("ticketsManager.buttons.newTicket")}
            </Button>
            {tab === "open" && (
              <Can
                role={user.profile}
                perform="tickets-manager:showall"
                yes={() => (
                  <FormControlLabel
                    label={i18n.t("tickets.buttons.showAll")}
                    labelPlacement="start"
                    control={
                      <Switch
                        size="small"
                        checked={showAllTickets}
                        onChange={() =>
                          setShowAllTickets(prevState => !prevState)
                        }
                        name="showAllTickets"
                        color="primary"
                      />
                    }
                  />
                )}
              />
            )}
          </>
        )}
      </Paper>
      {(user?.queues || []).length > 0 && (
        <div className={classes.queueRow}>
          <span className={classes.queueLabel}>{i18n.t("tickets.views.queues")}</span>
          {(user?.queues || []).map(queue => (
            <button
              key={queue.id}
              type="button"
              aria-pressed={selectedQueueIds.includes(queue.id)}
              className={clsx(
                classes.queueChip,
                selectedQueueIds.includes(queue.id) && classes.queueChipOn
              )}
              onClick={() => toggleQueue(queue.id)}
            >
              <span
                className={classes.queueDot}
                style={{ backgroundColor: queue.color || "#7C7C7C" }}
              />
              {queue.name}
            </button>
          ))}
        </div>
      )}
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={val => setOpenCount(val)}
            style={applyPanelStyle("open")}
            setTabOpen={setTabOpen}
            showTabGroups={showTabGroups}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            updateCount={val => setPendingCount(val)}
            style={applyPanelStyle("pending")}
            setTabOpen={setTabOpen}
            showTabGroups={showTabGroups}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="paused" className={classes.ticketsWrapper}>
        <TicketsList
          status="paused"
          showAll={showAllTickets}
          selectedQueueIds={selectedQueueIds}
          showTabGroups={showTabGroups}
        />
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          showTabGroups={showTabGroups}
        />
      </TabPanel>
      <TabPanel value={tab} name="groups" className={classes.ticketsWrapper}>
        <TicketsList
          groups={true}
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          showTabGroups={showTabGroups}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <Box style={{ paddingRight: 10, paddingLeft: 10 }}>
          <ContactSelect
            onSelected={contactId => {
              setSelectedContact(contactId);
            }}
            allowCreate={false}
          />
        </Box>
        <TagsFilter onFiltered={handleSelectedTags} />
        {profile === "admin" && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}
        <TicketsList
          isSearch={true}
          searchParam={searchParam}
          showAll={true}
          contactId={selectedContact}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
          showTabGroups={showTabGroups}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;
