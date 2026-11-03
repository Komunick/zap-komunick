import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hotp,
  normalizeRecoveryCode,
  otpauthUri,
  totp,
  verifyTotp
} from "../../helpers/Totp";
import {
  canSignInFrom,
  isIpAllowed,
  normalizeIp,
  parseAllowlist
} from "../../helpers/IpAllowlist";

// RFC 6238, appendix B: ASCII "12345678901234567890" with HMAC-SHA1
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the test vectors of RFC 6238 (8 digits)", () => {
    expect(totp(RFC_SECRET, 59 * 1000, 8)).toBe("94287082");
    expect(totp(RFC_SECRET, 1111111109 * 1000, 8)).toBe("07081804");
    expect(totp(RFC_SECRET, 1234567890 * 1000, 8)).toBe("89005924");
    expect(totp(RFC_SECRET, 20000000000 * 1000, 8)).toBe("65353130");
  });

  it("matches the HOTP vectors of RFC 4226", () => {
    const key = Buffer.from("12345678901234567890");
    expect(hotp(key, 0)).toBe("755224");
    expect(hotp(key, 9)).toBe("520489");
  });

  it("round-trips base32", () => {
    const buffer = Buffer.from([0, 1, 2, 250, 255, 128, 77]);
    expect(base32Decode(base32Encode(buffer))).toEqual(buffer);
    expect(base32Encode(Buffer.from("12345678901234567890"))).toBe(
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    );
    expect(() => base32Decode("abc1")).toThrow("ERR_INVALID_BASE32");
  });

  it("accepts the code of now and of 30 s before or after, nothing else", () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now + 30000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90000), now)).toBe(false);
    expect(
      verifyTotp(
        secret,
        `${totp(secret, now).slice(0, 3)} ${totp(secret, now).slice(3)}`,
        now
      )
    ).toBe(true);
  });

  it("refuses malformed codes and an empty secret", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
    expect(verifyTotp(secret, undefined)).toBe(false);
    expect(verifyTotp("", "123456")).toBe(false);
  });

  it("creates 160-bit secrets and the URI the apps read", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(otpauthUri(secret, "ana@empresa.com", "Zap Komunick")).toBe(
      `otpauth://totp/Zap%20Komunick%3Aana%40empresa.com?secret=${secret}&issuer=Zap%20Komunick&algorithm=SHA1&digits=6&period=30`
    );
  });

  it("creates distinct recovery codes and reads them loosely", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    codes.forEach(code => expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/));
    expect(normalizeRecoveryCode(" 7k3q 9mzd ")).toBe("7K3Q-9MZD");
  });
});

describe("IP allowlist", () => {
  it("reads one address or range per line, with comments", () => {
    expect(
      parseAllowlist(
        "200.10.1.5  # escritorio\n10.0.0.0/8\n\n2804:14c::/32, ::ffff:177.1.2.3\nabc\n10.0.0.0/33"
      )
    ).toEqual({
      entries: ["200.10.1.5", "10.0.0.0/8", "2804:14c::/32", "177.1.2.3"],
      invalid: ["abc", "10.0.0.0/33"]
    });
  });

  it("matches exact addresses and ranges, IPv4 and IPv6", () => {
    const entries = ["200.10.1.5", "10.0.0.0/8", "2804:14c::/32"];
    expect(isIpAllowed("200.10.1.5", entries)).toBe(true);
    expect(isIpAllowed("::ffff:10.20.30.40", entries)).toBe(true);
    expect(isIpAllowed("2804:14c:1::9", entries)).toBe(true);
    expect(isIpAllowed("200.10.1.6", entries)).toBe(false);
    expect(isIpAllowed("2804:14d::1", entries)).toBe(false);
    expect(isIpAllowed("not-an-ip", entries)).toBe(false);
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });

  it("lets everybody in when off, and the super user always", () => {
    const setting = { enabled: true, entries: ["200.10.1.5"] };
    expect(canSignInFrom("8.8.8.8", setting, {})).toBe(false);
    expect(canSignInFrom("8.8.8.8", setting, { super: true })).toBe(true);
    expect(canSignInFrom("8.8.8.8", { ...setting, enabled: false }, {})).toBe(
      true
    );
  });
});
