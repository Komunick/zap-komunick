// Zap Komunick: wallet in bulk (docs/PRD.md, RF-014). Either the contacts
// picked in the list, or every contact of one owner moved to another (for
// example when someone leaves the team).

export const WALLET_BULK_MAX_CONTACTS = 500;

export type WalletBulkRequest =
  | {
      mode: "contacts";
      contactIds: number[];
      walletUserId: number | null;
    }
  | {
      mode: "transfer";
      // null = the contacts that have no owner
      fromUserId: number | null;
      walletUserId: number | null;
    };

const positiveInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// "" / null / undefined mean "no owner"; anything else must be a valid id
const ownerOrNone = (value: unknown): number | null | false => {
  if (value === null || value === undefined || value === "" || value === 0) {
    return null;
  }
  return positiveInt(value) ?? false;
};

/**
 * Validates the body of PUT /contacts/wallet/bulk. Returns an error code
 * instead when it is invalid.
 */
export function parseWalletBulk(body: Record<string, unknown> | undefined): {
  request?: WalletBulkRequest;
  error?: string;
} {
  const walletUserId = ownerOrNone(body?.walletUserId);
  if (walletUserId === false) {
    return { error: "ERR_WALLET_BULK_INVALID_USER" };
  }

  if (body?.mode === "transfer") {
    const fromUserId = ownerOrNone(body.fromUserId);
    if (fromUserId === false) {
      return { error: "ERR_WALLET_BULK_INVALID_USER" };
    }
    if (fromUserId === walletUserId) {
      return { error: "ERR_WALLET_BULK_SAME_OWNER" };
    }
    return { request: { mode: "transfer", fromUserId, walletUserId } };
  }

  if (body?.mode !== "contacts") {
    return { error: "ERR_WALLET_BULK_INVALID_MODE" };
  }

  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
    return { error: "ERR_WALLET_BULK_NO_CONTACTS" };
  }
  const ids = body.contactIds.map(positiveInt);
  if (ids.some(id => id === null)) {
    return { error: "ERR_WALLET_BULK_INVALID_CONTACT" };
  }
  const contactIds = Array.from(new Set(ids as number[]));
  if (contactIds.length > WALLET_BULK_MAX_CONTACTS) {
    return { error: "ERR_WALLET_BULK_TOO_MANY" };
  }
  return { request: { mode: "contacts", contactIds, walletUserId } };
}
