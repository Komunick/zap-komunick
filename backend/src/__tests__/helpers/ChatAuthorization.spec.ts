import {
  chatAccessError,
  chatParticipantIds,
  positiveChatId
} from "../../helpers/ChatAuthorization";

describe("chat authorization rules", () => {
  const group = { companyId: 10, ownerId: 1, isDirect: false };
  it.each([
    undefined,
    null,
    {},
    [],
    true,
    0,
    -1,
    1.5,
    "1e2",
    "1.0",
    " 1",
    "",
    "1 OR 1=1",
    Number.MAX_SAFE_INTEGER + 1
  ])("rejects ambiguous identifier %p", value => {
    expect(positiveChatId(value)).toBeUndefined();
  });
  it.each([1, "1", 901, "901"])(
    "accepts a positive canonical identifier %p",
    value => {
      expect(positiveChatId(value)).toBe(Number(value));
    }
  );
  it("does not grant administrator or stale foreign membership a bypass", () => {
    expect(chatAccessError(group, { userId: 4, companyId: 20 }, [1, 4])).toBe(
      "ERR_NO_CHAT_FOUND"
    );
    expect(chatAccessError(group, { userId: 3, companyId: 10 }, [1, 2])).toBe(
      "ERR_NO_CHAT_FOUND"
    );
  });
  it("allows ordinary members to communicate but only the owner to manage", () => {
    expect(
      chatAccessError(group, { userId: 2, companyId: 10 }, [1, 2])
    ).toBeUndefined();
    expect(
      chatAccessError(group, { userId: 2, companyId: 10 }, [1, 2], true)
    ).toBe("ERR_NO_PERMISSION");
    expect(
      chatAccessError(group, { userId: 1, companyId: 10 }, [1, 2], true)
    ).toBeUndefined();
  });
  it("keeps direct participants/history immutable even for its creator", () => {
    expect(
      chatAccessError(
        { ...group, isDirect: true },
        { userId: 1, companyId: 10 },
        [1, 2],
        true
      )
    ).toBe("ERR_CHAT_DIRECT_READONLY");
  });
  it("retains the owner once and rejects an invalid participant list as a whole", () => {
    expect(chatParticipantIds([{ id: 2 }, { id: "2" }, { id: 1 }], 1)).toEqual([
      1, 2
    ]);
    expect(
      chatParticipantIds([{ id: 2 }, { id: "4 OR 1=1" }], 1)
    ).toBeUndefined();
    expect(chatParticipantIds("2", 1)).toBeUndefined();
  });
});
