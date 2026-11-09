import { resolveWalletAssignment } from "../../helpers/WalletRules";

const base = {
  enabled: true,
  isGroup: false,
  companyId: 1,
  walletUserId: 7,
  ownerCompanyId: 1,
  ownerQueueIds: [3, 5],
  connectionQueueIds: [5, 9]
};

describe("resolveWalletAssignment", () => {
  it("assigns the ticket to the owner in a queue served by the connection", () => {
    expect(resolveWalletAssignment(base)).toEqual({ userId: 7, queueId: 5 });
  });

  it("keeps normal routing when the connection serves none of the owner's queues", () => {
    expect(
      resolveWalletAssignment({ ...base, connectionQueueIds: [9] })
    ).toBeNull();
  });

  it("does not assign an owner without queues on a connection that serves queues", () => {
    expect(resolveWalletAssignment({ ...base, ownerQueueIds: [] })).toBeNull();
  });

  it("keeps queue-less assignment when the owner and connection have no queues", () => {
    expect(
      resolveWalletAssignment({
        ...base,
        ownerQueueIds: [],
        connectionQueueIds: []
      })
    ).toEqual({ userId: 7, queueId: null });
  });

  it("keeps the normal flow when the option is disabled", () => {
    expect(resolveWalletAssignment({ ...base, enabled: false })).toBeNull();
  });

  it("keeps the normal flow for groups", () => {
    expect(resolveWalletAssignment({ ...base, isGroup: true })).toBeNull();
  });

  it("keeps the normal flow when the contact has no wallet owner", () => {
    expect(resolveWalletAssignment({ ...base, walletUserId: null })).toBeNull();
  });

  it("never assigns to a user of another company", () => {
    expect(resolveWalletAssignment({ ...base, ownerCompanyId: 2 })).toBeNull();
  });

  it("keeps the normal flow when the owner no longer exists", () => {
    expect(
      resolveWalletAssignment({ ...base, ownerCompanyId: null })
    ).toBeNull();
  });
});
