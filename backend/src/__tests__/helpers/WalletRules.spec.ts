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

  it("uses the first owner queue when the connection serves none of them", () => {
    expect(
      resolveWalletAssignment({ ...base, connectionQueueIds: [9] })
    ).toEqual({ userId: 7, queueId: 3 });
  });

  it("assigns without queue when the owner has no queues", () => {
    expect(resolveWalletAssignment({ ...base, ownerQueueIds: [] })).toEqual({
      userId: 7,
      queueId: null
    });
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
