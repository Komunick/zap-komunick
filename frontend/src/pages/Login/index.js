import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { Link as RouterLink } from "react-router-dom";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import MenuItem from "@material-ui/core/MenuItem";
import Popover from "@material-ui/core/Popover";
import Fade from "@material-ui/core/Fade";
import Paper from "@material-ui/core/Paper";
import MenuList from "@material-ui/core/MenuList";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import { alpha, makeStyles, useTheme } from "@material-ui/core/styles";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import LanguageIcon from "@material-ui/icons/Translate";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import MailOutlineIcon from "@material-ui/icons/MailOutline";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import { messages } from "../../translate/languages";

import { AuthContext } from "../../context/Auth/AuthContext";
import useSettings from "../../hooks/useSettings";
import { getBackendURL } from "../../services/config";
import ColorModeContext from "../../layout/themeContext";
import { loadJSON } from "../../helpers/loadJSON";
import { BRAND_BLACK, BRAND_GREEN } from "../../theme/komunick";
import TwoFactorForm from "./TwoFactorForm";

// Zap Komunick: two column sign in (form + brand panel), following the
// authentication layout of the Komunick Patterns. Whitelabel side image and
// background content still replace the brand panel when configured.

const gitinfo = loadJSON("/gitinfo.json");

const parseLoginLinks = value => {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      link => typeof link?.title === "string" && typeof link?.url === "string"
    );
  } catch (error) {
    return [];
  }
};

const isVideoFile = (filename = "") => /\.(mp4|webm|ogg)$/i.test(filename);

const getPublicAssetUrl = filename => {
  if (!filename) {
    return "";
  }

  return `${getBackendURL()}/public/${filename}`;
};

const useStyles = makeStyles(theme => ({
  root: {
    position: "fixed",
    inset: 0,
    display: "flex",
    backgroundColor: theme.palette.background.default,
    overflow: "hidden"
  },
  formSide: {
    position: "relative",
    flex: "1 1 50%",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(4, 6),
    backgroundColor: theme.palette.background.paper,
    overflowY: "auto",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(3, 2.5)
    }
  },
  formTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  logoImg: {
    height: 40,
    maxWidth: 200,
    objectFit: "contain",
    content: `url("${theme.calculatedLogo()}")`
  },
  topActions: {
    display: "flex",
    gap: theme.spacing(0.5)
  },
  topButton: {
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary
  },
  formCenter: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4, 0)
  },
  formBox: {
    width: "100%",
    maxWidth: 400
  },
  title: {
    fontWeight: 800,
    fontSize: "1.9rem",
    letterSpacing: "-0.02em",
    marginBottom: theme.spacing(1)
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3)
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    marginTop: theme.spacing(2),
    display: "block"
  },
  inputIcon: {
    color: theme.palette.text.secondary,
    fontSize: 20
  },
  submit: {
    marginTop: theme.spacing(3),
    height: 48,
    fontSize: 15,
    borderRadius: 12
  },
  signup: {
    marginTop: theme.spacing(2.5),
    color: theme.palette.text.secondary,
    fontSize: 14
  },
  linksContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(3)
  },
  footerLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: theme.spacing(0.75, 1.75),
    borderRadius: 999,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontSize: 13,
    textDecoration: "none",
    "&:hover": {
      backgroundColor: theme.komunick.hover,
      textDecoration: "none"
    }
  },
  formFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: theme.palette.text.secondary,
    fontSize: 12
  },
  brandSide: {
    position: "relative",
    flex: "1 1 50%",
    margin: theme.spacing(2),
    marginLeft: 0,
    borderRadius: 28,
    overflow: "hidden",
    color: "#fff",
    background: `radial-gradient(120% 90% at 85% 10%, ${alpha(
      BRAND_GREEN,
      0.55
    )} 0%, transparent 55%), linear-gradient(160deg, #0F3A12 0%, ${BRAND_BLACK} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: theme.spacing(6),
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  brandMedia: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  route: {
    position: "absolute",
    right: -40,
    top: 40,
    width: "70%",
    opacity: 0.35,
    pointerEvents: "none"
  },
  heroTitle: {
    position: "relative",
    fontWeight: 800,
    fontSize: "2.4rem",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    maxWidth: 460
  },
  heroSubtitle: {
    position: "relative",
    marginTop: theme.spacing(2),
    maxWidth: 440,
    color: "rgba(255,255,255,0.78)",
    fontSize: 16
  },
  points: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(3)
  },
  point: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: 600
  },
  pointIcon: {
    fontSize: 16,
    color: BRAND_GREEN
  },
  preview: {
    position: "relative",
    alignSelf: "flex-end",
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: theme.spacing(2),
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    backdropFilter: "blur(10px)"
  },
  previewRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    color: "#101814",
    "& + &": {
      marginTop: theme.spacing(1)
    }
  },
  previewAvatar: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#fff",
    flex: "none"
  },
  previewChannel: {
    position: "absolute",
    right: -3,
    bottom: -3,
    fontSize: 15,
    color: "#25D366",
    backgroundColor: "#fff",
    borderRadius: "50%"
  },
  previewText: {
    flex: 1,
    minWidth: 0
  },
  previewName: {
    fontWeight: 700,
    fontSize: 14
  },
  previewMessage: {
    fontSize: 12,
    color: "#5C6862",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  previewChip: {
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    padding: "3px 8px",
    whiteSpace: "nowrap"
  },
  langMenuPaper: {
    minWidth: 160,
    borderRadius: 12,
    overflow: "hidden"
  }
}));

const RouteGraphic = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 400 300"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M10 250 C 90 250, 90 150, 170 150 S 250 60, 330 60 L 390 60"
      stroke={BRAND_GREEN}
      strokeWidth="3"
      strokeDasharray="2 10"
      strokeLinecap="round"
    />
    {[
      [10, 250],
      [170, 150],
      [330, 60]
    ].map(([cx, cy]) => (
      <g key={`${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r="14" fill={alpha(BRAND_GREEN, 0.25)} />
        <circle cx={cx} cy={cy} r="6" fill={BRAND_GREEN} />
      </g>
    ))}
  </svg>
);

// illustrative rows only (no real data)
const previewRows = [
  {
    initials: "CM",
    color: "#1F7F1B",
    nameKey: "login.hero.preview.client1",
    messageKey: "login.hero.preview.message1",
    chip: "login.hero.preview.chipSla",
    chipStyle: { backgroundColor: "#FDE7E7", color: "#B42318" }
  },
  {
    initials: "PA",
    color: "#2E6BE6",
    nameKey: "login.hero.preview.client2",
    messageKey: "login.hero.preview.message2",
    chip: "login.hero.preview.chipWallet",
    chipStyle: { backgroundColor: "#E5F4E3", color: "#1F7F1B" }
  },
  {
    initials: "LF",
    color: "#B7791F",
    nameKey: "login.hero.preview.client3",
    messageKey: "login.hero.preview.message3",
    chip: "login.hero.preview.chipKanban",
    chipStyle: { backgroundColor: "#FFF4DB", color: "#8A5A00" }
  }
];

const Login = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { getPublicSetting } = useSettings();
  const { colorMode } = useContext(ColorModeContext);

  const [langMenuAnchor, setLangMenuAnchor] = useState(null);
  const currentLanguage =
    localStorage.getItem("language") || i18n.language || "en";

  const handleChooseLanguage = lang => {
    setLangMenuAnchor(null);
    localStorage.setItem("language", lang);
    window.location.reload(false);
  };

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  const [loginLinks, setLoginLinks] = useState([]);
  const [sidePanelImage, setSidePanelImage] = useState("");
  const [backgroundContent, setBackgroundContent] = useState("");
  const [secondFactor, setSecondFactor] = useState(null);
  const mounted = useRef(true);

  const { handleLogin, handleVerifyTwoFactor, cancelLogin, authenticating } =
    useContext(AuthContext);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelLogin();
    };
  }, [cancelLogin]);

  const invalidateSecondFactor = useCallback(() => {
    cancelLogin();
    setSecondFactor(current => current && { ...current, challenge: null });
  }, [cancelLogin]);

  const backToPassword = () => {
    cancelLogin();
    setSecondFactor(null);
    setUser(current => ({ ...current, password: "" }));
  };

  const handleChangeInput = event => {
    setUser(prevUser => ({
      ...prevUser,
      [event.target.name]: event.target.value.trim()
    }));
  };

  const handlSubmit = async event => {
    event.preventDefault();
    if (authenticating) return;
    const result = await handleLogin(user);
    if (mounted.current && result.twoFactorRequired) {
      setUser(current => ({ ...current, password: "" }));
      setShowPassword(false);
      setSecondFactor(result);
    }
  };

  useEffect(() => {
    Promise.all([
      getPublicSetting("allowSignup"),
      getPublicSetting("loginPageLinks"),
      getPublicSetting("loginSidePanelImage"),
      getPublicSetting("loginBackgroundContent")
    ])
      .then(
        ([
          allowSignupValue,
          loginLinksValue,
          sidePanelImageValue,
          backgroundContentValue
        ]) => {
          setAllowSignup(allowSignupValue === "enabled");
          setLoginLinks(parseLoginLinks(loginLinksValue));
          setSidePanelImage(sidePanelImageValue || "");
          setBackgroundContent(backgroundContentValue || "");
        }
      )
      .catch(error => {
        console.log("Error reading setting", error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidePanelImageUrl = getPublicAssetUrl(sidePanelImage);
  const backgroundAssetUrl = getPublicAssetUrl(backgroundContent);
  const isLightMode = theme.palette.type === "light";

  const renderBrandMedia = () => {
    if (sidePanelImageUrl) {
      return (
        <img
          className={classes.brandMedia}
          src={sidePanelImageUrl}
          alt={i18n.t("login.title")}
        />
      );
    }
    if (backgroundAssetUrl && isVideoFile(backgroundContent)) {
      return (
        <video className={classes.brandMedia} autoPlay loop muted playsInline>
          <source src={backgroundAssetUrl} />
        </video>
      );
    }
    if (backgroundAssetUrl) {
      return (
        <img
          className={classes.brandMedia}
          src={backgroundAssetUrl}
          alt={i18n.t("login.title")}
        />
      );
    }
    return null;
  };

  const brandMedia = renderBrandMedia();

  return (
    <div className={classes.root}>
      <CssBaseline />
      <div className={classes.formSide}>
        <div className={classes.formTop}>
          <img className={classes.logoImg} alt={theme.appName || "logo"} />
          <div className={classes.topActions}>
            <Tooltip title={i18n.t("mainDrawer.appBar.i18n.language")}>
              <IconButton
                size="small"
                className={classes.topButton}
                onClick={event => setLangMenuAnchor(event.currentTarget)}
                aria-label={i18n.t("mainDrawer.appBar.i18n.language")}
              >
                <LanguageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              className={classes.topButton}
              onClick={colorMode.toggleColorMode}
              aria-label={
                isLightMode
                  ? i18n.t("login.darkMode")
                  : i18n.t("login.lightMode")
              }
            >
              {isLightMode ? (
                <Brightness4Icon fontSize="small" />
              ) : (
                <Brightness7Icon fontSize="small" />
              )}
            </IconButton>
          </div>
        </div>
        <Popover
          open={Boolean(langMenuAnchor)}
          anchorEl={langMenuAnchor}
          onClose={() => setLangMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          TransitionComponent={Fade}
          PaperProps={{ className: classes.langMenuPaper }}
          disableScrollLock
        >
          <Paper elevation={0}>
            <MenuList>
              {Object.keys(messages).map(lang => (
                <MenuItem
                  key={lang}
                  onClick={() => handleChooseLanguage(lang)}
                  selected={currentLanguage === lang}
                >
                  {messages[lang].translations.mainDrawer.appBar.i18n.language}
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </Popover>

        <div className={classes.formCenter}>
          <div className={classes.formBox}>
            <Typography component="h1" className={classes.title}>
              {i18n.t(secondFactor ? "login2fa.title" : "login.welcome")}
            </Typography>
            <Typography className={classes.subtitle}>
              {i18n.t(
                secondFactor ? "login2fa.subtitle" : "login.welcomeSubtitle"
              )}
            </Typography>
            {secondFactor ? (
              <TwoFactorForm
                challenge={secondFactor.challenge}
                expiresAt={secondFactor.expiresAt}
                busy={authenticating}
                onVerify={handleVerifyTwoFactor}
                onCancel={backToPassword}
                onInvalidate={invalidateSecondFactor}
              />
            ) : (
              <form
                noValidate
                onSubmit={handlSubmit}
                aria-busy={authenticating}
              >
                <label className={classes.label} htmlFor="email">
                  {i18n.t("login.form.email")}
                </label>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  id="email"
                  name="email"
                  value={user.email}
                  onChange={handleChangeInput}
                  disabled={authenticating}
                  autoComplete="email"
                  autoFocus
                  inputProps={{ "aria-label": i18n.t("login.form.email") }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineIcon className={classes.inputIcon} />
                      </InputAdornment>
                    )
                  }}
                />
                <label className={classes.label} htmlFor="password">
                  {i18n.t("login.form.password")}
                </label>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="password"
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={user.password}
                  onChange={handleChangeInput}
                  disabled={authenticating}
                  autoComplete="current-password"
                  inputProps={{ "aria-label": i18n.t("login.form.password") }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon className={classes.inputIcon} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showPassword
                              ? i18n.t("common.hidePassword")
                              : i18n.t("common.showPassword")
                          }
                          onClick={() => setShowPassword(!showPassword)}
                          onMouseDown={event => event.preventDefault()}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submit}
                  disabled={authenticating}
                  startIcon={
                    authenticating ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : null
                  }
                >
                  {i18n.t(
                    authenticating
                      ? "login2fa.signingIn"
                      : "login.buttons.submit"
                  )}
                </Button>
                {allowSignup && (
                  <Typography className={classes.signup}>
                    {i18n.t("login.noAccount")}{" "}
                    <Link component={RouterLink} to="/signup">
                      {i18n.t("login.buttons.register")}
                    </Link>
                  </Typography>
                )}
              </form>
            )}
            {loginLinks.length > 0 && (
              <div className={classes.linksContainer}>
                {loginLinks.map((link, index) => (
                  <a
                    className={classes.footerLink}
                    href={link.url}
                    key={`${link.url}-${index}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={classes.formFooter}>
          <span>
            © {new Date().getFullYear()} {theme.appName}
          </span>
          <span>
            {gitinfo.tagName ||
              `${gitinfo.branchName || "N/A"} ${gitinfo.commitHash || "N/A"}`}
          </span>
        </div>
      </div>

      <div className={classes.brandSide}>
        {brandMedia || (
          <>
            <RouteGraphic className={classes.route} />
            <div>
              <Typography component="h2" className={classes.heroTitle}>
                {i18n.t("login.hero.title")}
              </Typography>
              <Typography className={classes.heroSubtitle}>
                {i18n.t("login.hero.subtitle")}
              </Typography>
              <div className={classes.points}>
                {["sla", "wallet", "kanban"].map(point => (
                  <span key={point} className={classes.point}>
                    <CheckCircleIcon className={classes.pointIcon} />
                    {i18n.t(`login.hero.points.${point}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className={classes.preview} aria-hidden="true">
              {previewRows.map(row => (
                <div key={row.initials} className={classes.previewRow}>
                  <div
                    className={classes.previewAvatar}
                    style={{ backgroundColor: row.color }}
                  >
                    {row.initials}
                    <WhatsAppIcon className={classes.previewChannel} />
                  </div>
                  <div className={classes.previewText}>
                    <div className={classes.previewName}>
                      {i18n.t(row.nameKey)}
                    </div>
                    <div className={classes.previewMessage}>
                      {i18n.t(row.messageKey)}
                    </div>
                  </div>
                  <span className={classes.previewChip} style={row.chipStyle}>
                    {i18n.t(row.chip)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
