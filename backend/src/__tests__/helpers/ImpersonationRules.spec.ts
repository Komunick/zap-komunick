import {
  currentAccessMatches,
  impersonationOrigin,
  positiveSessionId,
  sessionPairMatches,
  validTokenVersion
} from "../../helpers/ImpersonationRules";

describe("impersonation identifiers and revocation versions", () => {
  it.each([1, "1", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)])(
    "normalizes a safe positive identifier %s",
    value => expect(positiveSessionId(value)).toBe(Number(value))
  );
  it.each([
    undefined,
    null,
    true,
    [],
    {},
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "",
    "0",
    "01",
    " 1",
    "1 ",
    "+1",
    "1.0",
    "1e1",
    "NaN"
  ])("rejects an invalid identifier %j", value =>
    expect(positiveSessionId(value)).toBeUndefined()
  );
  it.each([0, 1, Number.MAX_SAFE_INTEGER])(
    "accepts numeric token version %s",
    value => {
      expect(validTokenVersion(value)).toBe(true);
    }
  );
  it.each([
    undefined,
    null,
    false,
    "0",
    "3",
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1
  ])("rejects invalid token version %j", value =>
    expect(validTokenVersion(value)).toBe(false)
  );
});

const origin = {
  originalUserId: 103,
  originalCompanyId: 10,
  originalTokenVersion: 0
};
const target = { id: 201, companyId: 20, profile: "admin", super: false };
const derived = { ...target, impersonated: true, ...origin };

describe("bounded impersonation metadata", () => {
  it("accepts and normalizes an explicit origin with version zero", () => {
    expect(
      impersonationOrigin({
        impersonated: true,
        originalUserId: "103",
        originalCompanyId: "10",
        originalTokenVersion: 0
      })
    ).toEqual(origin);
  });
  it.each([
    { impersonated: false },
    { impersonated: "true" },
    { originalUserId: undefined },
    { originalUserId: 0 },
    { originalCompanyId: undefined },
    { originalCompanyId: "010" },
    { originalTokenVersion: undefined },
    { originalTokenVersion: "0" },
    { originalTokenVersion: -1 },
    { originalTokenVersion: 0.5 }
  ])("refuses incomplete, legacy or malformed origin %j", patch => {
    expect(impersonationOrigin({ ...derived, ...patch })).toBeUndefined();
  });
});

describe("the two signed credentials describe the same session", () => {
  it("accepts matching normal credentials with omitted or false flags", () => {
    expect(
      sessionPairMatches(target, {
        id: "201",
        companyId: "20",
        impersonated: false
      })
    ).toBe(true);
  });
  it("ignores stray origin metadata when neither credential is delegated", () => {
    expect(
      sessionPairMatches({ ...target, ...origin, impersonated: false }, target)
    ).toBe(true);
  });
  it("accepts matching delegated credentials with a numeric zero origin version", () => {
    expect(
      sessionPairMatches(derived, { ...derived, id: "201", companyId: "20" })
    ).toBe(true);
  });
  it.each([
    { id: 202 },
    { companyId: 10 },
    { id: undefined },
    { companyId: 0 },
    { impersonated: false },
    { impersonated: "true" },
    { originalUserId: 104 },
    { originalCompanyId: 30 },
    { originalTokenVersion: 1 },
    { originalTokenVersion: undefined },
    { originalTokenVersion: "0" }
  ])("rejects mismatched or incomplete delegated credentials %j", patch => {
    expect(sessionPairMatches(derived, { ...derived, ...patch })).toBe(false);
  });
  it("does not authorize a legacy delegated pair even when both versions are absent", () => {
    const legacy = { ...derived, originalTokenVersion: undefined };
    expect(sessionPairMatches(legacy, legacy)).toBe(false);
  });
  it("rejects a non-boolean flag on an otherwise normal pair", () => {
    expect(
      sessionPairMatches({ ...target, impersonated: "false" }, target)
    ).toBe(false);
  });
});

describe("access claims match the current database identity and privileges", () => {
  it("accepts a matching account and normalized claim identifiers", () => {
    expect(
      currentAccessMatches({ ...target, id: "201", companyId: "20" }, target)
    ).toBe(true);
  });
  it.each([
    { id: 202 },
    { companyId: 10 },
    { profile: "user" },
    { super: true },
    { super: "false" },
    { super: undefined, isSuper: false }
  ])("does not accept stale or wrongly named claims %j", patch => {
    expect(currentAccessMatches({ ...target, ...patch }, target)).toBe(false);
  });
});
