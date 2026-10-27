import React, { useState, useContext, useEffect } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import SearchIcon from "@material-ui/icons/Search";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import CommandPalette from "../components/CommandPalette";
import NavTabs from "./NavTabs";
import AccountCircle from "@material-ui/icons/AccountCircle";
import SettingsEthernetIcon from "@material-ui/icons/SettingsEthernet";
import CachedIcon from "@material-ui/icons/Cached";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import { Backendlogs } from "../components/Backendlogs";
import { PhoneCall } from "../components/PhoneCall";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import AboutModal from "../components/AboutModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import DarkMode from "../components/DarkMode";
import { i18n } from "../translate/i18n";
import { messages } from "../translate/languages";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";

import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";

import { useDate } from "../hooks/useDate";
import useAuth from "../hooks/useAuth.js";

import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import LanguageIcon from "@material-ui/icons/Language";
import { getBackendURL } from "../services/config";
import NestedMenuItem from "material-ui-nested-menu-item";
import NewTicketModal from "../components/NewTicketModal/index.js";
import { loadJSON } from "../helpers/loadJSON";

const gitinfo = loadJSON("/gitinfo.json");

const drawerWidth = 264;
const DRAWER_STORAGE_KEY = "drawerOpen";

function getStoredDrawerOpen() {
  return localStorage.getItem(DRAWER_STORAGE_KEY) === "true";
}

function persistDrawerOpenState(value) {
  localStorage.setItem(DRAWER_STORAGE_KEY, String(value));
}

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    height: "var(--vh)",
    backgroundColor: theme.palette.background.default,
    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary,
      border:
        theme.mode === "light"
          ? "1px solid rgba(0 124 102)"
          : "1px solid rgba(255, 255, 255, 0.5)"
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.palette.primary
    }
  },
  avatar: {
    width: 30,
    height: 30,
    fontSize: theme.typography.pxToRem(14),
    display: "block",
    boxSizing: "border-box",
    flexShrink: 0
  },
  userInfoWrapper: {
    display: "flex",
    alignItems: "center"
  },
  profileTrigger: {
    display: "flex",
    alignItems: "center",
    width: "fit-content",
    minWidth: 40,
    maxWidth: 160,
    borderRadius: 20,
    overflow: "hidden",
    cursor: "pointer",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.komunick.subtle,
    [theme.breakpoints.down("xs")]: {
      borderRadius: 20
    }
  },
  profileAvatarSlot: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "0 20px 20px 0"
  },
  userInfoPanel: {
    display: "none",
    [theme.breakpoints.up("sm")]: {
      display: "flex",
      flex: 1,
      minWidth: 0,
      maxWidth: 120,
      flexDirection: "column",
      justifyContent: "center",
      height: 40,
      paddingLeft: 14,
      paddingRight: 8,
      borderRadius: "20px 0 0 20px",
      boxSizing: "border-box",
      overflow: "hidden"
    }
  },
  userInfoName: {
    color: theme.palette.text.primary,
    fontSize: 11,
    lineHeight: "15px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%"
  },
  userInfoCompany: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    lineHeight: "15px",
    opacity: 0.75,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%"
  },
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
    color:
      localStorage.getItem("impersonated") === "true"
        ? theme.palette.secondary.contrastText
        : theme.palette.text.primary,
    background:
      localStorage.getItem("impersonated") === "true"
        ? theme.palette.secondary.main
        : theme.palette.background.paper,
    marginRight: "10px",
    marginTop: "10px",
    marginBottom: "10px",
    borderRadius: "14px",
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.komunick.shadow,
    // the upstream bar icons use primary.contrastText, made for a colored bar
    ...(localStorage.getItem("impersonated") === "true"
      ? {}
      : {
          "& .MuiIconButton-root:not(.MuiIconButton-colorSecondary)": {
            color: theme.palette.text.secondary
          },
          "& .MuiIconButton-root:not(.MuiIconButton-colorSecondary) .MuiSvgIcon-root":
            {
              color: "inherit !important"
            },
          "& $avatar": {
            color: `${theme.palette.text.secondary} !important`
          }
        })
  },
  // Zap Komunick: the collapse button lives in the sidebar, next to the logo
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 68,
    padding: "0 10px 0 14px",
    borderBottom: `1px solid ${theme.komunick.sidebarBorder}`,
    marginBottom: 6
  },
  sidebarHeaderClosed: {
    flexDirection: "column",
    justifyContent: "center",
    padding: "12px 0 8px",
    gap: 8
  },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    flex: "1 1 auto",
    minWidth: 0,
    cursor: "pointer",
    "& img": {
      margin: 0,
      height: 40,
      maxWidth: 156
    }
  },
  sidebarLogoClosed: {
    flex: "none",
    "& img": {
      width: 36,
      height: 36
    }
  },
  sidebarToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    color: theme.komunick.sidebarText,
    backgroundColor: theme.komunick.sidebarHover,
    "&:hover": {
      color: theme.komunick.sidebarHoverText,
      backgroundColor: theme.komunick.sidebarHover
    }
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "68px",
    margin: "auto"
  },
  appBar: {
    marginLeft: "72px",
    boxShadow: "unset",
    width: "unset",
    right: 0,
    left: 0,
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },
  appBarMobile: {
    marginLeft: "10px"
  },
  appBarShift: {
    marginLeft: drawerWidth,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  menuButton: {
    color: "inherit"
  },
  menuButtonHidden: {
    display: "none"
  },
  title: {
    flexGrow: 1,
    fontSize: 14,
    fontWeight: 600,
    color: "inherit"
  },
  wsConnectionAlertButton: {
    marginRight: theme.spacing(1.5),
    color: "inherit",
    padding: theme.spacing(0.5)
  },
  wsConnectionAlertIcon: {
    fontSize: 20
  },
  wsConnectionBadge: {
    "& .MuiBadge-badge": {
      minWidth: 10,
      width: 10,
      height: 10,
      borderRadius: "50%",
      backgroundColor: "#ff4d4f",
      border: "none",
      boxShadow: "none"
    }
  },
  userMenuInfoContainer: {
    padding: theme.spacing(1.5, 2),
    maxWidth: 320
  },
  userMenuInfoLine: {
    fontSize: 13,
    lineHeight: 1.4
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    }),
    overflowY: "clip",
    border: "unset",
    // Zap Komunick: black side menu (Direção B)
    borderRight: `1px solid ${theme.komunick.sidebarBorder}`,
    backgroundColor: theme.komunick.sidebar,
    color: theme.komunick.sidebarText,
    ...theme.scrollbarStylesSoft
  },
  drawerPaperClose: {
    overflowX: "hidden",
    overflowY: "hidden",
    marginBottom: "10px",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9)
    }
  },
  appBarSpacer: {
    minHeight: "48px"
  },
  content: {
    flex: 1,
    overflow: "auto",
    position: "absolute",
    top: "68px",
    bottom: 0,
    right: "0px",
    left: "72px",
    marginLeft: "0px",
    marginRight: "10px",
    marginBottom: "10px",
    borderRadius: "14px",
    "&::-webkit-scrollbar": {
      width: "10px",
      height: "8px"
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.komunick.borderStrong,
      borderRadius: "10px"
    }
  },
  contentShift: {
    left: drawerWidth,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  contentMobile: {
    left: "10px"
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4)
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column"
  },
  containerWideWithScroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "clip",
    marginRight: "10px",
    marginLeft: "10px",
    border: "none",
    // Zap Komunick: section titles of the menu
    "& .MuiListSubheader-root": {
      fontSize: "12.5px !important",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: theme.komunick.sidebarMuted,
      lineHeight: "36px",
      marginTop: 10
    },
    "& .MuiDivider-root": {
      margin: "10px 4px 4px",
      backgroundColor: theme.komunick.sidebarBorder
    },
    "&::-webkit-scrollbar": {
      width: "10px",
      height: "8px"
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.komunick.sidebarBorder,
      borderRadius: "10px"
    },
    color: theme.komunick.sidebarText
  },
  containerNarrowWithScroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    marginRight: "10px",
    marginLeft: "10px",
    border: "none",
    // Zap Komunick: section titles of the menu
    "& .MuiListSubheader-root": {
      fontSize: "12.5px !important",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: theme.komunick.sidebarMuted,
      lineHeight: "36px",
      marginTop: 10
    },
    "& .MuiDivider-root": {
      margin: "10px 4px 4px",
      backgroundColor: theme.komunick.sidebarBorder
    },
    "&::-webkit-scrollbar": {
      width: "10px",
      height: "8px"
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.komunick.sidebarBorder,
      borderRadius: "10px"
    }
  },
  NotificationsPopOver: {
    // color: theme.barraSuperior.secondary.main,
  },
  logo: {
    maxWidth: "192px",
    height: "68px",
    logo: theme.logo,
    margin: "auto",
    content: `url("${theme.calculatedLogo()}")`
  },
  logoIcon: {
    width: "48px",
    height: "48px",
    logo: theme.logo,
    content: `url("${theme.calculatedLogoFavicon()}")`
  },
  version: {
    margin: "auto",
    fontSize: "11px",
    textAlign: "center",
    color: theme.komunick.sidebarMuted,
    fontWeight: 600
  },
  hideLogo: {
    display: "none"
  },
  // Zap Komunick: flat shell shared by the Workspace and Foco layouts
  toolbarFlat: {
    margin: 0,
    borderRadius: 0,
    border: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    minHeight: 56,
    height: 56,
    padding: "0 16px",
    gap: 2
  },
  appBarFoco: {
    marginLeft: 0
  },
  // layout "Painel": compact light side menu, 224 px wide
  appBarPainel: {
    marginLeft: 224
  },
  contentPainel: {
    left: 224
  },
  contentWarm: {
    backgroundColor: "#F7F6F2"
  },
  drawerPainelOpen: {
    width: 224
  },
  drawerCompact: {
    "& .MuiListItem-root": {
      minHeight: 36,
      margin: "1px 0",
      borderRadius: 8
    },
    "& .MuiListItemText-primary": {
      fontSize: 14,
      fontWeight: 600
    },
    "& .MuiListItemIcon-root": {
      minWidth: 36
    },
    "& .MuiSvgIcon-root, & svg": {
      fontSize: 20
    }
  },
  sidebarTitle: {
    flex: 1,
    paddingLeft: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: theme.komunick.sidebarMuted
  },
  contentFlat: {
    top: 56,
    right: 0,
    marginRight: 0,
    marginBottom: 0,
    borderRadius: 0
  },
  contentFlatFoco: {
    top: 100,
    left: 0,
    marginLeft: 0
  },
  barLogo: {
    height: 26,
    marginRight: 14,
    cursor: "pointer",
    content: `url("${theme.calculatedLogo()}")`
  },
  searchSlot: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    minWidth: 0,
    padding: "0 12px",
    [theme.breakpoints.down("xs")]: {
      flex: "none",
      padding: "0 4px"
    }
  },
  searchTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "min(520px, 100%)",
    height: 36,
    padding: "0 12px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    backgroundColor: theme.komunick.subtle,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
    textAlign: "left",
    // on phones the search is just the magnifier button
    [theme.breakpoints.down("xs")]: {
      width: 36,
      padding: 0,
      justifyContent: "center",
      "& > :not(svg)": { display: "none" }
    },
    "&:hover": {
      borderColor: theme.komunick.borderStrong
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`
    }
  },
  searchLabel: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  kbd: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper
  },
  themeSwitch: {
    margin: "0 8px 0 0",
    "& .MuiFormControlLabel-label": {
      fontSize: 12,
      color: theme.palette.text.secondary
    },
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  versionBox: {
    backgroundColor: theme.komunick.sidebarHover,
    border: `1px solid ${theme.komunick.sidebarBorder}`,
    margin: "10px",
    padding: "6px 8px",
    borderRadius: "10px"
  }
}));

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const history = useHistory();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(() => {
    const isDesktop = window.matchMedia("(min-width:600px)").matches;

    if (!isDesktop) {
      return false;
    }

    return getStoredDrawerOpen();
  });
  const [drawerVariant, setDrawerVariant] = useState("permanent");

  // Zap Komunick: two layouts, "workspace" (icon rail) and "foco" (top tabs)
  const [layoutMode, setLayoutMode] = useState(() =>
    ["foco", "painel"].includes(localStorage.getItem("layoutMode"))
      ? localStorage.getItem("layoutMode")
      : "workspace"
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const focoDesktop = layoutMode === "foco" && drawerVariant !== "temporary";
  const painelDesktop =
    layoutMode === "painel" && drawerVariant !== "temporary";

  useEffect(() => {
    const onKeyDown = event => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key?.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  // const [dueDate, setDueDate] = useState("");
  const { user } = useContext(AuthContext);

  const theme = useTheme();

  // the light, warm side menu of the Painel layout (light theme only)
  useEffect(() => {
    const root = document.documentElement;
    const vars = {
      "--zk-sidebar": "#F7F6F2",
      "--zk-sidebar-text": "#4E5C54",
      "--zk-sidebar-text-active": "#1F7F1B",
      "--zk-sidebar-hover": "rgba(2, 6, 5, 0.05)",
      "--zk-sidebar-hover-text": "#020605",
      "--zk-sidebar-active": "#FFFFFF",
      "--zk-sidebar-border": "#E8E6DF",
      "--zk-sidebar-muted": "#8A8F86"
    };
    const on = layoutMode === "painel" && theme.mode === "light";
    Object.entries(vars).forEach(([name, value]) => {
      if (on) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    });
    return () =>
      Object.keys(vars).forEach(name => root.style.removeProperty(name));
  }, [layoutMode, theme.mode]);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));
  const { colorMode, themeMode } = useContext(ColorModeContext);

  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  const { getCurrentUserInfo } = useAuth();
  const [currentUser, setCurrentUser] = useState({});
  const canAccessBackendlogs =
    currentUser?.super || localStorage.getItem("impersonated") === "true";

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);

  const { dateToClient } = useDate();

  const socketManager = useContext(SocketContext);
  const [wsConnectionIssue, setWsConnectionIssue] = useState(false);

  const [newTicketContact, setNewTicketContact] = useState(null);

  //################### CODIGOS DE TESTE #########################################
  // useEffect(() => {
  //   navigator.getBattery().then((battery) => {
  //     console.log(`Battery Charging: ${battery.charging}`);
  //     console.log(`Battery Level: ${battery.level * 100}%`);
  //     console.log(`Charging Time: ${battery.chargingTime}`);
  //     console.log(`Discharging Time: ${battery.dischargingTime}`);
  //   })
  // }, []);

  // useEffect(() => {
  //   const geoLocation = navigator.geolocation

  //   geoLocation.getCurrentPosition((position) => {
  //     let lat = position.coords.latitude;
  //     let long = position.coords.longitude;

  //     console.log('latitude: ', lat)
  //     console.log('longitude: ', long)
  //   })
  // }, []);

  // useEffect(() => {
  //   const nucleos = window.navigator.hardwareConcurrency;

  //   console.log('Nucleos: ', nucleos)
  // }, []);

  // useEffect(() => {
  //   console.log('userAgent', navigator.userAgent)
  //   if (
  //     navigator.userAgent.match(/Android/i)
  //     || navigator.userAgent.match(/webOS/i)
  //     || navigator.userAgent.match(/iPhone/i)
  //     || navigator.userAgent.match(/iPad/i)
  //     || navigator.userAgent.match(/iPod/i)
  //     || navigator.userAgent.match(/BlackBerry/i)
  //     || navigator.userAgent.match(/Windows Phone/i)
  //   ) {
  //     console.log('é mobile ', true) //celular
  //   }
  //   else {
  //     console.log('não é mobile: ', false) //nao é celular
  //   }
  // }, []);
  //##############################################################################

  useEffect(() => {
    getCurrentUserInfo().then(user => {
      setCurrentUser(user);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentLang = localStorage.getItem("language");
    if (currentLang) {
      setCurrentLanguage(currentLang);
    }
  }, []);

  useEffect(() => {
    window.mentionClick = mention => {
      const contact = {
        id: mention.contactId || mention.id,
        name: mention.name,
        number: mention.number
      };
      setNewTicketContact(contact);
    };
  }, []);

  useEffect(() => {
    if (greaterThenSm) {
      setDrawerVariant("permanent");
      setDrawerOpen(getStoredDrawerOpen());
      return;
    }

    setDrawerVariant("temporary");
    setDrawerOpen(false);
  }, [greaterThenSm]);

  useEffect(() => {
    if (!greaterThenSm) {
      return;
    }

    persistDrawerOpenState(drawerOpen);
  }, [drawerOpen, greaterThenSm]);

  useEffect(() => {
    if (!socketManager?.subscribeWsConnectionIssue) {
      return undefined;
    }

    return socketManager.subscribeWsConnectionIssue(setWsConnectionIssue);
  }, [socketManager]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");

    const socket = socketManager.GetSocket(companyId);

    const onCompanyAuthLayout = data => {
      const impersonated = localStorage.getItem("impersonated") === "true";
      if (
        !impersonated &&
        !data.user.impersonated &&
        data.user.id === +userId
      ) {
        toastError("Sua conta foi acessada em outro computador.");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1000);
      }
    };

    socket.on(`company-${companyId}-auth`, onCompanyAuthLayout);

    socket.emit("userStatus");
    const interval = setInterval(
      () => {
        socket.emit("userStatus");
      },
      1000 * 60 * 5
    );

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [socketManager]);

  const handleProfileMenu = event => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseProfileMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleCloseLanguageMenu = () => {
    setAnchorEl(null);
    setLanguageOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseProfileMenu();
  };

  const handleOpenAboutModal = () => {
    setAboutModalOpen(true);
    handleCloseProfileMenu();
  };

  const handleClickLogout = () => {
    handleCloseProfileMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600) {
      setDrawerOpen(false);
    }
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(prevState => {
      const nextState = !prevState;
      if (greaterThenSm) {
        persistDrawerOpenState(nextState);
      }
      return nextState;
    });
  };

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  const toggleColorMode = () => {
    colorMode.toggleColorMode();
    handleCloseProfileMenu();
  };

  const chooseLayout = mode => {
    localStorage.setItem("layoutMode", mode);
    setLayoutMode(mode);
    handleCloseProfileMenu();
  };

  const handleChooseLanguage = language => {
    localStorage.setItem("language", language);
    window.location.reload(false);
  };

  const userCompanyId = Number(user?.companyId ?? user?.company?.id ?? 0);
  const shouldShowCompanyDueDate =
    user?.profile === "admin" && userCompanyId !== 1;
  const companyDueDateText = user?.company?.dueDate
    ? dateToClient(user.company.dueDate)
    : "-";

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      {!focoDesktop && (
        <Drawer
          variant={drawerVariant}
          className={
            drawerOpen ? classes.drawerPaper : classes.drawerPaperClose
          }
          onClose={drawerClose}
          classes={{
            paper: clsx(
              classes.drawerPaper,
              !drawerOpen && classes.drawerPaperClose,
              painelDesktop && drawerOpen && classes.drawerPainelOpen,
              painelDesktop && classes.drawerCompact
            )
          }}
          open={drawerOpen}
        >
          <div
            className={clsx(
              classes.sidebarHeader,
              !drawerOpen && classes.sidebarHeaderClosed
            )}
          >
            {painelDesktop ? (
              drawerOpen && (
                <span className={classes.sidebarTitle}>
                  {i18n.t("layoutMode.menu")}
                </span>
              )
            ) : (
              <div
                className={clsx(
                  classes.sidebarLogo,
                  !drawerOpen && classes.sidebarLogoClosed
                )}
                onClick={handleDrawerToggle}
              >
                <img
                  className={drawerOpen ? classes.logo : classes.logoIcon}
                  alt="logo"
                />
              </div>
            )}
            {drawerVariant !== "temporary" && (
              <Tooltip
                title={
                  drawerOpen
                    ? i18n.t("mainDrawer.collapseMenu")
                    : i18n.t("mainDrawer.expandMenu")
                }
                placement="right"
              >
                <IconButton
                  aria-label={
                    drawerOpen
                      ? i18n.t("mainDrawer.collapseMenu")
                      : i18n.t("mainDrawer.expandMenu")
                  }
                  className={classes.sidebarToggle}
                  onClick={handleDrawerToggle}
                >
                  {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </IconButton>
              </Tooltip>
            )}
          </div>
          <List
            className={
              drawerOpen
                ? classes.containerWideWithScroll
                : classes.containerNarrowWithScroll
            }
          >
            <MainListItems
              drawerClose={drawerClose}
              drawerOpen={drawerOpen}
              collapsed={!drawerOpen}
            />
          </List>
          {drawerOpen && gitinfo.commitHash !== "N/A" && (
            <div className={classes.versionBox}>
              <Typography className={classes.version}>
                {gitinfo.tagName ||
                  `${gitinfo.branchName} ${gitinfo.commitHash}`}
              </Typography>
            </div>
          )}
        </Drawer>
      )}
      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
      <AboutModal
        open={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <AppBar
        position="absolute"
        className={clsx(
          classes.appBar,
          drawerVariant === "temporary" && classes.appBarMobile,
          drawerOpen && !focoDesktop && classes.appBarShift,
          focoDesktop && classes.appBarFoco,
          painelDesktop && drawerOpen && classes.appBarPainel
        )}
        color="transparent"
      >
        <Toolbar
          variant="dense"
          className={clsx(classes.toolbar, classes.toolbarFlat)}
        >
          {(focoDesktop || painelDesktop) && (
            <img
              className={classes.barLogo}
              alt="logo"
              onClick={() => history.push("/tickets")}
            />
          )}
          {drawerVariant === "temporary" && (
            <IconButton
              edge="start"
              variant="contained"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              className={classes.menuButton}
            >
              {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          )}

          <div className={classes.searchSlot}>
            <button
              type="button"
              className={classes.searchTrigger}
              onClick={() => setPaletteOpen(true)}
              aria-label={i18n.t("layoutMode.searchPlaceholder")}
            >
              <SearchIcon fontSize="small" />
              <span className={classes.searchLabel}>
                {i18n.t("layoutMode.searchPlaceholder")}
              </span>
              <span className={classes.kbd}>Ctrl K</span>
            </button>
          </div>

          <FormControlLabel
            className={classes.themeSwitch}
            control={
              <Switch
                size="small"
                color="primary"
                checked={theme.mode === "dark"}
                onChange={toggleColorMode}
              />
            }
            label={i18n.t("layoutMode.darkMode")}
          />

          {wsConnectionIssue && (
            <Tooltip title={i18n.t("common.connection")} arrow>
              <span
                aria-label={i18n.t("common.connection")}
                className={classes.wsConnectionAlertButton}
              >
                <Badge
                  variant="dot"
                  overlap="circular"
                  color="secondary"
                  anchorOrigin={{ vertical: "top", horizontal: "right" }}
                  className={classes.wsConnectionBadge}
                >
                  <SettingsEthernetIcon
                    className={classes.wsConnectionAlertIcon}
                  />
                </Badge>
              </span>
            </Tooltip>
          )}

          {canAccessBackendlogs && <Backendlogs />}

          <PhoneCall />

          <NotificationsVolume setVolume={setVolume} volume={volume} />

          {user.id && <NotificationsPopOver volume={volume} />}

          <AnnouncementsPopover />

          <ChatPopover />

          <div className={classes.userInfoWrapper}>
            <div
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenu}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleProfileMenu(event);
                }
              }}
              role="button"
              tabIndex={0}
              className={classes.profileTrigger}
            >
              <div className={classes.userInfoPanel}>
                <Typography noWrap className={classes.userInfoName}>
                  {user?.name || currentUser?.name || "-"}
                </Typography>
                <Typography noWrap className={classes.userInfoCompany}>
                  {user?.company?.name || "-"}
                </Typography>
              </div>
              <div className={classes.profileAvatarSlot}>
                <AccountCircle
                  className={classes.avatar}
                  style={{ color: theme.palette.primary.contrastText }}
                />
              </div>
            </div>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right"
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right"
              }}
              open={menuOpen}
              onClose={handleCloseProfileMenu}
            >
              <div className={classes.userMenuInfoContainer}>
                <Typography className={classes.userMenuInfoLine}>
                  {i18n.t("common.name")}: {user?.name || "-"}
                </Typography>
                <Typography className={classes.userMenuInfoLine}>
                  {i18n.t("common.company")}: {user?.company?.name || "-"}
                </Typography>
                {shouldShowCompanyDueDate && (
                  <Typography className={classes.userMenuInfoLine}>
                    {i18n.t(
                      "mainDrawer.appBar.user.subscriptionValidUntilLabel"
                    )}
                    : {companyDueDateText}
                  </Typography>
                )}
              </div>
              <Divider />
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleCloseProfileMenu();
                  history.push("/account-security");
                }}
              >
                {i18n.t("accountSecurity.title")}
              </MenuItem>
              <MenuItem onClick={toggleColorMode}>
                {theme.mode === "dark"
                  ? i18n.t("mainDrawer.appBar.user.lightmode")
                  : i18n.t("mainDrawer.appBar.user.darkmode")}
              </MenuItem>
              <MenuItem
                selected={layoutMode === "workspace"}
                onClick={() => chooseLayout("workspace")}
              >
                {i18n.t("layoutMode.title")}: {i18n.t("layoutMode.workspace")}
              </MenuItem>
              <MenuItem
                selected={layoutMode === "foco"}
                onClick={() => chooseLayout("foco")}
              >
                {i18n.t("layoutMode.title")}: {i18n.t("layoutMode.foco")}
              </MenuItem>
              <MenuItem
                selected={layoutMode === "painel"}
                onClick={() => chooseLayout("painel")}
              >
                {i18n.t("layoutMode.title")}: {i18n.t("layoutMode.painel")}
              </MenuItem>
              <MenuItem
                selected={themeMode === "system"}
                onClick={() => {
                  colorMode.followSystem();
                  handleCloseProfileMenu();
                }}
              >
                {i18n.t("layoutMode.systemTheme")}
              </MenuItem>
              <NestedMenuItem
                label={i18n.t("mainDrawer.appBar.user.language")}
                parentMenuOpen={menuOpen}
              >
                {Object.keys(messages).map(m => (
                  <MenuItem onClick={() => handleChooseLanguage(m)}>
                    <div
                      style={{
                        fontWeight: currentLanguage === m ? "bold" : "normal"
                      }}
                    >
                      {messages[m].translations.mainDrawer.appBar.i18n.language}
                    </div>
                  </MenuItem>
                ))}
              </NestedMenuItem>
              <MenuItem onClick={handleOpenAboutModal}>
                {i18n.t("about.aboutthe")}{" "}
                {currentUser?.super ? "ticketz" : theme.appName}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      {focoDesktop && <NavTabs isAdmin={user?.profile === "admin"} />}
      <NewTicketModal
        modalOpen={!!newTicketContact}
        contact={newTicketContact}
        onClose={ticket => {
          setNewTicketContact(null);
          if (ticket !== undefined && ticket.uuid !== undefined) {
            history.push(`/tickets/${ticket.uuid}`);
          }
        }}
      />
      <main
        className={clsx(
          drawerVariant === "temporary" && classes.contentMobile,
          drawerOpen && !focoDesktop && classes.contentShift,
          classes.content,
          classes.contentFlat,
          focoDesktop && classes.contentFlatFoco,
          painelDesktop && drawerOpen && classes.contentPainel,
          painelDesktop && theme.mode === "light" && classes.contentWarm
        )}
      >
        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
