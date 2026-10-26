import { createTheme } from "@material-ui/core/styles";
import { merge } from "lodash";

// Zap Komunick: visual identity applied over the Ticketz theme
// (docs/TAD.md, "Visual"). Komunick colors: green #35B62E and black #020605,
// font Manrope. References: Dribbble shots listed in docs/TAD.md.

export const BRAND_GREEN = "#35B62E";
// darker green for buttons and links, readable with white text (WCAG AA)
export const BRAND_GREEN_DEEP = "#1F7F1B";
export const BRAND_BLACK = "#020605";

// darker still, hover of the deep green buttons
export const BRAND_GREEN_PRESSED = "#196916";

export const DEFAULT_PRIMARY_LIGHT = BRAND_GREEN_DEEP;
export const DEFAULT_PRIMARY_DARK = BRAND_GREEN;

// Direção B (Stitch, docs/design/stitch-direcao-b): the black side menu is the
// same in both modes; the green marks the active item and the selected row.
// The "Painel" layout swaps them for a light, warm side menu through CSS variables
// (set on the document by layout/index.js), so no component needs to know.
const sidebarTokens = {
  sidebar: `var(--zk-sidebar, ${BRAND_BLACK})`,
  sidebarText: "var(--zk-sidebar-text, #A3A3A3)",
  sidebarTextActive: `var(--zk-sidebar-text-active, ${BRAND_GREEN})`,
  sidebarHover: "var(--zk-sidebar-hover, rgba(255, 255, 255, 0.05))",
  sidebarHoverText: "var(--zk-sidebar-hover-text, #FFFFFF)",
  sidebarActive: "var(--zk-sidebar-active, rgba(255, 255, 255, 0.05))",
  sidebarMuted: "var(--zk-sidebar-muted, #6B7A72)",
  accent: BRAND_GREEN,
  accentPressed: BRAND_GREEN_PRESSED
};

const tokens = mode =>
  mode === "light"
    ? {
        ...sidebarTokens,
        sidebarBorder: "var(--zk-sidebar-border, #1A221E)",
        canvas: "#F3F5F4",
        paper: "#FFFFFF",
        subtle: "#F7F9F8",
        border: "#E4E9E6",
        borderStrong: "#D3DAD6",
        text: BRAND_BLACK,
        textSecondary: "#5C6862",
        hover: "rgba(2, 6, 5, 0.04)",
        chatBackground: "#ECF0ED",
        // message composer: its own tone, floating over the conversation
        composer: "#FFFFFF",
        composerBorder: "#DCE6DF",
        composerShadow: "0 2px 8px rgba(2, 6, 5, 0.08)",
        bubbleMine: "#EAF7EA",
        bubbleMineBorder: "#CDECCB",
        bubbleTheirs: "#FFFFFF",
        bubbleMineQuoted: "#D6EFD3",
        bubbleTheirsQuoted: "#EEF2EF",
        selectedRow: "rgba(53, 182, 46, 0.08)",
        tagBackground: "#EAEFEA",
        shadow: "0 1px 2px rgba(2, 6, 5, 0.05)",
        shadowRaised: "0 12px 32px rgba(2, 6, 5, 0.10)"
      }
    : {
        ...sidebarTokens,
        sidebarBorder: "var(--zk-sidebar-border, #232C27)",
        canvas: "#0C110E",
        paper: "#141A17",
        subtle: "#18201C",
        border: "#232C27",
        borderStrong: "#2E3933",
        text: "#E9EFEB",
        textSecondary: "#9AA8A0",
        hover: "rgba(233, 239, 235, 0.06)",
        chatBackground: "#0F1512",
        composer: "#22302A",
        composerBorder: "#2F4038",
        composerShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
        bubbleMine: "#1E4A22",
        bubbleMineBorder: "#2A6130",
        bubbleTheirs: "#1B2420",
        bubbleMineQuoted: "#173A1A",
        bubbleTheirsQuoted: "#141B17",
        selectedRow: "rgba(53, 182, 46, 0.12)",
        tagBackground: "#18201C",
        shadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
        shadowRaised: "0 12px 32px rgba(0, 0, 0, 0.45)"
      };

/**
 * Theme options merged over the upstream ones in App.js. Keeps every custom
 * palette key used by the Ticketz components and only changes their values.
 */
export function komunickThemeOptions(mode) {
  const t = tokens(mode);
  const radius = 12;

  return {
    komunick: t,
    shape: { borderRadius: radius },
    typography: {
      fontFamily:
        "'Manrope', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700, letterSpacing: "-0.01em" },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 }
    },
    palette: {
      background: { default: t.canvas, paper: t.paper },
      divider: t.border,
      text: { primary: t.text, secondary: t.textSecondary },
      secondary: { main: mode === "light" ? BRAND_BLACK : "#E9EFEB" },
      backgroundContrast: {
        default: t.subtle,
        paper: t.subtle,
        border: t.border
      },
      light: { main: t.subtle },
      chatBubbleFromMe: { main: t.bubbleMine },
      chatBubbleReceived: { main: t.bubbleTheirs },
      chatBackground: { main: t.chatBackground },
      tabHeaderBackground: t.paper,
      optionsBackground: t.subtle,
      options: t.subtle,
      fancyBackground: t.canvas,
      bordabox: t.border,
      newmessagebox: t.subtle,
      inputdigita: t.paper,
      contactdrawer: t.paper,
      announcements: t.subtle,
      login: t.paper,
      announcementspopover: t.paper,
      chatlist: { main: t.border },
      boxlist: t.subtle,
      boxchatlist: t.subtle,
      total: t.paper,
      inputBackground: t.paper,
      boxticket: t.subtle,
      campaigntab: t.subtle
    },
    scrollbarStyles: {
      "&::-webkit-scrollbar": { width: "8px", height: "8px" },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: t.borderStrong,
        borderRadius: 8
      },
      "&::-webkit-scrollbar-track": { backgroundColor: "transparent" }
    },
    scrollbarStylesSoft: {
      "&::-webkit-scrollbar": { width: "6px" },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: t.border,
        borderRadius: 8
      }
    },
    overrides: {
      MuiCssBaseline: {
        "@global": {
          body: { backgroundColor: t.canvas }
        }
      },
      MuiPaper: {
        rounded: { borderRadius: radius + 2 },
        outlined: { borderColor: t.border },
        elevation1: { boxShadow: t.shadow },
        elevation2: { boxShadow: t.shadow },
        elevation3: { boxShadow: t.shadowRaised },
        elevation4: { boxShadow: t.shadowRaised },
        elevation6: { boxShadow: t.shadowRaised },
        elevation8: { boxShadow: t.shadowRaised }
      },
      MuiButton: {
        root: { borderRadius: 10, padding: "7px 16px" },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          "&:active": { boxShadow: "none" }
        },
        outlined: { borderColor: t.borderStrong, padding: "6px 15px" },
        sizeSmall: { borderRadius: 8 }
      },
      MuiIconButton: {
        root: { borderRadius: 10 }
      },
      MuiTabs: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: "3px 3px 0 0" }
      },
      MuiTab: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 44,
          "@media (min-width: 600px)": { minWidth: 72 }
        },
        labelIcon: { minHeight: 56 }
      },
      MuiChip: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          backgroundColor: t.tagBackground,
          color: t.text
        },
        outlined: { borderColor: t.borderStrong },
        sizeSmall: { height: 22 }
      },
      MuiOutlinedInput: {
        root: {
          borderRadius: 10,
          backgroundColor: t.paper
        },
        notchedOutline: { borderColor: t.borderStrong }
      },
      // a long label wrapped to two lines and covered the value of the field
      MuiInputLabel: {
        root: {
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "calc(100% - 24px)",
          "&$shrink": { maxWidth: "calc(133% - 32px)" }
        }
      },
      MuiInputBase: {
        root: { fontSize: "0.92rem" }
      },
      MuiDialog: {
        paper: { borderRadius: 18, boxShadow: t.shadowRaised }
      },
      MuiDialogTitle: {
        root: { padding: "20px 24px 12px" }
      },
      MuiDialogActions: {
        root: { padding: "12px 24px 20px" }
      },
      // the upstream CssBaseline sits outside the theme, so labels would keep
      // the browser's black text on the dark theme
      MuiFormControlLabel: {
        label: { color: t.text }
      },
      MuiTableHead: {
        root: { backgroundColor: t.subtle }
      },
      MuiTableCell: {
        root: { borderBottomColor: t.border },
        head: {
          fontWeight: 700,
          color: t.textSecondary,
          fontSize: "0.78rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }
      },
      MuiTooltip: {
        tooltip: {
          backgroundColor: mode === "light" ? "#18211C" : "#E9EFEB",
          color: mode === "light" ? "#FFFFFF" : "#101814",
          fontSize: "0.75rem",
          borderRadius: 8,
          padding: "6px 10px"
        },
        arrow: { color: mode === "light" ? "#18211C" : "#E9EFEB" }
      },
      MuiMenu: {
        paper: { borderRadius: 12, border: `1px solid ${t.border}` }
      },
      MuiPopover: {
        paper: { borderRadius: 12 }
      },
      MuiBadge: {
        badge: { fontWeight: 700 }
      },
      MuiDivider: {
        root: { backgroundColor: t.border }
      },
      MuiSwitch: {
        switchBase: { "&$checked + $track": { opacity: 0.9 } },
        track: { borderRadius: 10 }
      }
    }
  };
}

/**
 * Same signature as createTheme: receives the upstream theme options (which
 * carry `mode`) and applies the Komunick identity over them.
 */
export function createKomunickTheme(options, ...args) {
  return createTheme(
    merge({}, options, komunickThemeOptions(options.mode)),
    ...args
  );
}
