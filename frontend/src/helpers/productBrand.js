export const PRODUCT_NAME = "SuperChat";
export const PRODUCT_ICON = "/vector/superchat-icon.svg";

const defaultLogos = new Set([
  "/vector/logo.svg",
  "/vector/logo-dark.svg",
  "/vector/logo-header.svg",
  "/vector/logo-header-dark.svg"
]);

export const usesDefaultProductLogo = logo => !logo || defaultLogos.has(logo);

const legacyNames = new Set([
  "ticketz",
  "ticketz - chat based ticket system",
  "whitelabel chat",
  "whitelabelchat"
]);

// Resolve branding only; never apply this to messages, contacts or audit history.
export const resolveProductName = value => {
  if (typeof value !== "string" || !value.trim()) return PRODUCT_NAME;
  const name = value.trim();
  if (legacyNames.has(name.toLowerCase().replace(/\s+/g, " "))) {
    return PRODUCT_NAME;
  }
  return name.replace(/\bZap[\s-]+Komunick\b/gi, PRODUCT_NAME);
};

export const showsKomunickEndorsement = theme =>
  resolveProductName(theme.appName) === PRODUCT_NAME &&
  usesDefaultProductLogo(theme.calculatedLogo?.());
