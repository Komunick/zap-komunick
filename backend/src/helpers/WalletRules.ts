// Zap Komunick: client wallet rules (docs/PRD.md, RF-003)

export interface WalletAssignmentInput {
  enabled: boolean;
  isGroup: boolean;
  companyId: number;
  walletUserId?: number | null;
  // company of the wallet owner, null when the user no longer exists
  ownerCompanyId?: number | null;
  ownerQueueIds: number[];
  connectionQueueIds: number[];
}

export interface WalletAssignment {
  userId: number;
  queueId: number | null;
}

/**
 * Decides to whom a new or reopened ticket goes when the contact has a wallet
 * owner. Returns null when the ticket must follow the normal flow.
 */
export function resolveWalletAssignment(
  input: WalletAssignmentInput
): WalletAssignment | null {
  if (!input.enabled || input.isGroup || !input.walletUserId) {
    return null;
  }

  if (!input.ownerCompanyId || input.ownerCompanyId !== input.companyId) {
    return null;
  }

  // prefer a queue of the owner that is served by the connection, so the
  // ticket stays visible to the owner
  const queueId =
    input.ownerQueueIds.find(id => input.connectionQueueIds.includes(id)) ??
    input.ownerQueueIds[0] ??
    null;

  return { userId: input.walletUserId, queueId };
}
