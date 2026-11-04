import { PRODUCT_NAME, resolveProductName } from "../../helpers/ProductBrand";

describe("product brand presentation", () => {
  it.each([
    undefined,
    null,
    "",
    " \n ",
    42,
    {},
    "Ticketz",
    "TIcketz",
    "Ticketz - Chat Based Ticket System",
    "whitelabel chat",
    "whitelabelchat"
  ])("uses the product default for %p", value => {
    expect(resolveProductName(value)).toBe("SuperChat");
  });

  it.each([
    ["Zap Komunick", "SuperChat"],
    ["  ZAP KOMUNICK  ", "SuperChat"],
    ["Zap-Komunick Atendimento", "SuperChat Atendimento"],
    ["Portal Zap Komunick • Equipe", "Portal SuperChat • Equipe"],
    ["Zap Komunick / zap komunick", "SuperChat / SuperChat"]
  ])("replaces legacy product words in %s", (value, expected) => {
    expect(resolveProductName(value)).toBe(expected);
  });

  it.each([
    "SuperChat",
    "Equipe Aurora",
    "Ticketz Consultoria",
    "Whitelabel Chat Aurora",
    "Portal Zap Komunickado"
  ])("preserves the customized name %s", value => {
    expect(resolveProductName(value)).toBe(value);
  });

  it("is stable when a product name crosses more than one presentation layer", () => {
    expect(resolveProductName(resolveProductName("Portal Zap Komunick"))).toBe(
      "Portal SuperChat"
    );
    expect(PRODUCT_NAME).toBe("SuperChat");
  });
});
