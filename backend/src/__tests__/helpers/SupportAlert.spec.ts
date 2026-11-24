import {
  newSupportAlertToken,
  supportAlertTokenHash,
  supportAlertTokenMatches,
  supportAlertTokenOf
} from "../../helpers/SupportAlert";

describe("support alert key", () => {
  it("creates a different key each time and stores only its hash", () => {
    const first = newSupportAlertToken();
    const second = newSupportAlertToken();

    expect(first.token).toMatch(/^sca_[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(supportAlertTokenHash(first.token));
    expect(first.hash).not.toContain(first.token.slice(4, 20));
  });

  it("reads the key only from a well-formed Bearer header", () => {
    const { token } = newSupportAlertToken();

    expect(supportAlertTokenOf(`Bearer ${token}`)).toBe(token);
    expect(supportAlertTokenOf(`  bearer   ${token}  `)).toBe(token);
    [
      undefined,
      null,
      "",
      token,
      `Basic ${token}`,
      `Bearer ${token} extra`,
      "Bearer sca_curta",
      `Bearer ${token.replace("sca_", "xyz_")}`,
      `Bearer ${token}!`,
      ["Bearer", token]
    ].forEach(value => expect(supportAlertTokenOf(value)).toBeNull());
  });

  it("accepts the key of the stored hash and nothing else", () => {
    const current = newSupportAlertToken();
    const old = newSupportAlertToken();

    expect(supportAlertTokenMatches(current.token, current.hash)).toBe(true);
    expect(supportAlertTokenMatches(old.token, current.hash)).toBe(false);
    expect(supportAlertTokenMatches(null, current.hash)).toBe(false);
    expect(supportAlertTokenMatches(current.token, null)).toBe(false);
    expect(supportAlertTokenMatches(current.token, undefined)).toBe(false);
    expect(supportAlertTokenMatches(current.token, "")).toBe(false);
    // A stored value that is not a hash never matches, not even itself.
    expect(supportAlertTokenMatches(current.token, current.token)).toBe(false);
    expect(supportAlertTokenMatches(current.token, "zz".repeat(32))).toBe(
      false
    );
  });
});
