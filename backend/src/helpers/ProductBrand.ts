export const PRODUCT_NAME = "SuperChat";

const DEFAULT_PRODUCT_NAMES = new Set([
  "ticketz",
  "ticketz - chat based ticket system",
  "whitelabel chat",
  "whitelabelchat"
]);

// Resolve product branding only. Customer content and technical identifiers
// must never pass through this presentation-only compatibility rule.
export function resolveProductName(value: unknown): string {
  if (typeof value !== "string") return PRODUCT_NAME;
  const name = value.trim();
  if (!name || DEFAULT_PRODUCT_NAMES.has(name.toLowerCase())) {
    return PRODUCT_NAME;
  }
  return name.replace(/\bZap[\s-]+Komunick\b/gi, PRODUCT_NAME);
}
