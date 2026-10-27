import { isCredentialRequest } from "../../helpers/CredentialTelemetry";

describe("credential request telemetry", () => {
  it.each([
    "/credentials",
    "/credentials/openAiKey",
    "https://example.invalid/backend/credentials/migrate",
    "/credentials?unexpected=value",
    "/settings/openAiKey",
    "/settings/acessoriasApiToken",
    "/settings/sciPartnerToken",
    "/settings/sciClientToken",
    "/settings/%6fpenAiKey",
    "/Credentials/openAiKey",
    "/SeTtInGs/openAiKey"
  ])("excludes requests that could contain a credential: %s", url => {
    expect(isCredentialRequest(url)).toBe(true);
  });

  it.each([
    undefined,
    "/settings/slaMinutes",
    "/tickets/123",
    "/other?bad=%XX"
  ])("preserves unrelated error diagnostics: %s", url =>
    expect(isCredentialRequest(url)).toBe(false)
  );
});
