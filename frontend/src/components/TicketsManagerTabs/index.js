import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { alpha, makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { Box, Button } from "@material-ui/core";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPeopleGroup } from "@fortawesome/free-solid-svg-icons";
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
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{
              root: showTabGroups ? classes.tabWithGroups : classes.tab
            }}
          />

          <Tab
            value={"paused"}
            icon={<PauseCircleOutlineIcon />}
            label={i18n.t("tickets.tabs.paused.title")}
            classes={{
              root: showTabGroups ? classes.tabWithGroups : classes.tab
            }}
          />

          {showTabGroups && (
            <Tab
              value={"groups"}
              icon={
                <FontAwesomeIcon
                  className={classes.icon24}
                  icon={faPeopleGroup}
                />
              }
              label={i18n.t("tickets.tabs.groups.title")}
              classes={{ root: classes.tabWithGroups }}
            />
          )}

          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{
              root: showTabGroups ? classes.tabWithGroups : classes.tab
            }}
          />

          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{
              root: showTabGroups ? classes.tabWithGroups : classes.tab
            }}
          />
        </Tabs>
      </Paper>
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
        <TicketsQueueSelect
          style={{ marginLeft: 6 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={values => setSelectedQueueIds(values)}
        />
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          className={classes.statusTabs}
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color="primary"
                max={999}
              >
                {i18n.t("ticketsList.assignedHeader")}
              </Badge>
            }
            value={"open"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color="secondary"
                max={999}
              >
                {i18n.t("ticketsList.pendingHeader")}
              </Badge>
            }
            value={"pending"}
          />
        </Tabs>
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
