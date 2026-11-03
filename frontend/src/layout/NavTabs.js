import React, { useMemo, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { i18n } from "../translate/i18n";
import { buildNavItems, isActivePath } from "./navItems";

// Zap Komunick (layout Foco): navigation as underlined tabs under the top bar,
// with the less used pages inside a "More" menu.
const useStyles = makeStyles(theme => ({
  tabs: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    height: 44,
    zIndex: theme.zIndex.drawer + 1,
    display: "flex",
    alignItems: "stretch",
    gap: 4,
    padding: "0 16px",
    overflowX: "auto",
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&::-webkit-scrollbar": { height: 0 }
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: theme.palette.text.secondary,
    textDecoration: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    background: "none",
    border: "none",
    borderBottomStyle: "solid",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    fontFamily: "inherit",
    "&:hover": { color: theme.palette.text.primary },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2
    }
  },
  tabActive: {
    color: theme.palette.primary.main,
    borderBottomColor: theme.komunick.accent
  }
}));

const NavTabs = ({ isAdmin }) => {
  const classes = useStyles();
  const { pathname } = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const { main, more } = useMemo(() => buildNavItems(isAdmin), [isAdmin]);
  const moreActive = more.some(item => isActivePath(pathname, item.to));

  return (
    <nav className={classes.tabs} aria-label="navigation">
      {main.map(item => (
        <RouterLink
          key={item.id}
          to={item.to}
          aria-current={isActivePath(pathname, item.to) ? "page" : undefined}
          className={clsx(
            classes.tab,
            isActivePath(pathname, item.to) && classes.tabActive
          )}
        >
          {item.label}
        </RouterLink>
      ))}
      <button
        type="button"
        aria-haspopup="true"
        className={clsx(classes.tab, moreActive && classes.tabActive)}
        onClick={e => setAnchorEl(e.currentTarget)}
      >
        {i18n.t("layoutMode.more")}
        <ExpandMoreIcon fontSize="small" />
      </button>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {more.map(item => (
          <MenuItem
            key={item.id}
            component={RouterLink}
            to={item.to}
            selected={isActivePath(pathname, item.to)}
            onClick={() => setAnchorEl(null)}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </nav>
  );
};

export default NavTabs;
