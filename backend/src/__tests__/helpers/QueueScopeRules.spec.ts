import { queueListScope } from "../../helpers/QueueScopeRules";

describe("queue listing company scope", () => {
  it.each([false, true])(
    "uses the authenticated company when no filter is supplied (super=%s)",
    isSuper => {
      expect(queueListScope(10, isSuper, undefined)).toEqual({ companyId: 10 });
    }
  );

  it.each([false, true])(
    "permits an explicit own-company filter (super=%s)",
    isSuper => {
      expect(queueListScope(10, isSuper, "10")).toEqual({ companyId: 10 });
    }
  );

  it("refuses an ordinary actor's foreign-company filter", () => {
    expect(queueListScope(10, false, "20")).toEqual({
      error: "ERR_NO_PERMISSION",
      statusCode: 403
    });
  });

  it("preserves the authorized superuser's foreign-company filter", () => {
    expect(queueListScope(10, true, "20")).toEqual({ companyId: 20 });
  });

  it("accepts the largest safe canonical identifier for a superuser", () => {
    expect(queueListScope(10, true, String(Number.MAX_SAFE_INTEGER))).toEqual({
      companyId: Number.MAX_SAFE_INTEGER
    });
  });

  const invalid = [
    { label: "null", value: null },
    { label: "number instead of HTTP string", value: 20 },
    { label: "boolean", value: true },
    { label: "empty string", value: "" },
    { label: "zero", value: "0" },
    { label: "negative", value: "-20" },
    { label: "fraction", value: "20.5" },
    { label: "decimal notation", value: "20.0" },
    { label: "leading zero", value: "020" },
    { label: "leading space", value: " 20" },
    { label: "trailing space", value: "20 " },
    { label: "explicit plus", value: "+20" },
    { label: "exponent", value: "2e1" },
    { label: "hexadecimal", value: "0x14" },
    { label: "NaN", value: "NaN" },
    { label: "Infinity", value: "Infinity" },
    { label: "unsafe integer", value: "9007199254740992" },
    { label: "single-value array", value: ["20"] },
    { label: "repeated filter", value: ["10", "20"] },
    { label: "empty array", value: [] },
    { label: "object", value: { companyId: "20" } }
  ];

  describe.each([false, true])("malformed filter with super=%s", isSuper => {
    it.each(invalid)("rejects $label without numeric coercion", ({ value }) => {
      expect(queueListScope(10, isSuper, value)).toEqual({
        error: "ERR_BAD_REQUEST",
        statusCode: 400
      });
    });
  });
});
