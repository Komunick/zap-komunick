import { BlockList, isIP } from "net";

// Zap Komunick: access only from the company's addresses (docs/PRD.md,
// RF-016). One IP or CIDR range per line (IPv4 or IPv6); "#" starts a comment.

export const MAX_ALLOWLIST_ENTRIES = 100;

export interface ParsedAllowlist {
  entries: string[];
  invalid: string[];
}

/** "::ffff:10.0.0.1" (IPv4 seen through IPv6) becomes "10.0.0.1". */
export const normalizeIp = (ip: unknown): string => {
  const text = String(ip ?? "").trim();
  return text.startsWith("::ffff:") && isIP(text.slice(7)) === 4
    ? text.slice(7)
    : text;
};

const validEntry = (entry: string): boolean => {
  const [address, prefix, extra] = entry.split("/");
  const family = isIP(address);
  if (!family || extra !== undefined) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  const bits = Number(prefix);
  return bits >= 0 && bits <= (family === 4 ? 32 : 128);
};

export function parseAllowlist(text: unknown): ParsedAllowlist {
  const entries: string[] = [];
  const invalid: string[] = [];
  String(text ?? "")
    .split(/[\n,;]+/)
    .map(line => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .forEach(line => {
      const entry = normalizeIp(line);
      if (validEntry(entry)) {
        if (!entries.includes(entry)) entries.push(entry);
      } else {
        invalid.push(line);
      }
    });
  return { entries, invalid };
}

export function isIpAllowed(ip: unknown, entries: string[]): boolean {
  const address = normalizeIp(ip);
  const family = isIP(address);
  if (!family) return false;
  const list = new BlockList();
  entries.forEach(entry => {
    const [base, prefix] = entry.split("/");
    const type = isIP(base) === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) {
      list.addAddress(base, type);
    } else {
      list.addSubnet(base, Number(prefix), type);
    }
  });
  return list.check(address, family === 4 ? "ipv4" : "ipv6");
}

export interface AllowlistSetting {
  enabled: boolean;
  entries: string[];
}

/**
 * Whether a sign-in from this IP is allowed. Super users are never blocked,
 * so whoever runs the installation cannot be locked out.
 */
export function canSignInFrom(
  ip: unknown,
  setting: AllowlistSetting,
  user: { super?: boolean }
): boolean {
  if (!setting.enabled || user.super) return true;
  return isIpAllowed(ip, setting.entries);
}
