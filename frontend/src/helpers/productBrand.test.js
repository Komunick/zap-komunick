import { PRODUCT_NAME, resolveProductName } from "./productBrand";

describe("product branding", () => {
  test.each([
    undefined,
    null,
    "",
    "   ",
    false,
    {},
    "Ticketz",
    "TIcketz",
    "whitelabel chat"
  ])("uses SuperChat for an empty or upstream default: %p", value =>
    expect(resolveProductName(value)).toBe("SuperChat")
  );

  test.each([
    ["Zap Komunick", "SuperChat"],
    ["  ZAP KOMUNICK  ", "SuperChat"],
    ["Zap-Komunick - Atendimento", "SuperChat - Atendimento"],
    ["Portal Zap Komunick", "Portal SuperChat"]
  ])("replaces the legacy product name in branding: %s", (value, expected) => {
    expect(resolveProductName(value)).toBe(expected);
  });

  test.each([
    "Escritório Fictício",
    "Komunick Inteligência",
    "My Helpdesk",
    "ZapContábil"
  ])("preserves a distinct company name: %s", value =>
    expect(resolveProductName(value)).toBe(value)
  );

  it("uses the approved product capitalization", () => {
    expect(PRODUCT_NAME).toBe("SuperChat");
  });
});
