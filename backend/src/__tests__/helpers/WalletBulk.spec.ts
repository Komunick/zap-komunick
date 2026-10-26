import {
  parseWalletBulk,
  WALLET_BULK_MAX_CONTACTS
} from "../../helpers/WalletBulk";

describe("parseWalletBulk", () => {
  it("needs a known mode", () => {
    expect(parseWalletBulk({ walletUserId: 2 }).error).toBe(
      "ERR_WALLET_BULK_INVALID_MODE"
    );
    expect(parseWalletBulk(undefined).error).toBe(
      "ERR_WALLET_BULK_INVALID_MODE"
    );
  });

  it("sets the owner of the picked contacts, without repeats", () => {
    expect(
      parseWalletBulk({
        mode: "contacts",
        contactIds: [3, 3, 4],
        walletUserId: 2
      }).request
    ).toEqual({ mode: "contacts", contactIds: [3, 4], walletUserId: 2 });
  });

  it("removes the owner when no user is given", () => {
    expect(
      parseWalletBulk({ mode: "contacts", contactIds: [3], walletUserId: "" })
        .request
    ).toEqual({ mode: "contacts", contactIds: [3], walletUserId: null });
  });

  it("refuses empty, invalid or too many contacts", () => {
    expect(
      parseWalletBulk({ mode: "contacts", contactIds: [], walletUserId: 2 })
        .error
    ).toBe("ERR_WALLET_BULK_NO_CONTACTS");
    expect(
      parseWalletBulk({
        mode: "contacts",
        contactIds: [1, "x"],
        walletUserId: 2
      }).error
    ).toBe("ERR_WALLET_BULK_INVALID_CONTACT");
    const many = Array.from(
      { length: WALLET_BULK_MAX_CONTACTS + 1 },
      (_, i) => i + 1
    );
    expect(
      parseWalletBulk({ mode: "contacts", contactIds: many, walletUserId: 2 })
        .error
    ).toBe("ERR_WALLET_BULK_TOO_MANY");
  });

  it("refuses an invalid owner", () => {
    expect(
      parseWalletBulk({ mode: "contacts", contactIds: [1], walletUserId: -4 })
        .error
    ).toBe("ERR_WALLET_BULK_INVALID_USER");
  });

  it("moves a whole wallet, also from or to nobody", () => {
    expect(
      parseWalletBulk({ mode: "transfer", fromUserId: 5, walletUserId: 6 })
        .request
    ).toEqual({ mode: "transfer", fromUserId: 5, walletUserId: 6 });
    expect(
      parseWalletBulk({ mode: "transfer", fromUserId: null, walletUserId: 6 })
        .request
    ).toEqual({ mode: "transfer", fromUserId: null, walletUserId: 6 });
    expect(
      parseWalletBulk({ mode: "transfer", fromUserId: 5, walletUserId: null })
        .request
    ).toEqual({ mode: "transfer", fromUserId: 5, walletUserId: null });
  });

  it("refuses moving a wallet to the same owner", () => {
    expect(
      parseWalletBulk({ mode: "transfer", fromUserId: 5, walletUserId: 5 })
        .error
    ).toBe("ERR_WALLET_BULK_SAME_OWNER");
    expect(
      parseWalletBulk({ mode: "transfer", fromUserId: "", walletUserId: null })
        .error
    ).toBe("ERR_WALLET_BULK_SAME_OWNER");
  });
});
