import {
  isAcessoriasRequest,
  isCredentialRequest,
  isAssistantRequest,
  isSensitiveRequest
} from "../../helpers/CredentialTelemetry";

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
    "/settings/%6fpenAiKey?bad=%XX",
    "/settings/%6fpenAiKey#bad=%XX",
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

describe("authentication and security request telemetry", () => {
  it.each([
    "/auth/login",
    "/auth/2fa",
    "/auth/refresh_token",
    "/auth/logout",
    "/%61uth/login?bad=%XX",
    "/AUTH/2FA",
    "/security/me",
    "/security/2fa/setup",
    "/security/2fa/enable",
    "/security/2fa/disable",
    "/security/2fa/recovery-codes",
    "/security/ip-allowlist",
    "/%73ecurity/%32fa/disable?bad=%XX",
    "https://example.invalid/backend/security/2fa/setup",
    "/audit-logs?userId=11",
    "/users/11/2fa",
    "/users/11%2Fextra/2fa",
    "/users/11%XX/%32fa?bad=%XX",
    "https://example.invalid/backend/users/11/2fa"
  ])("excludes sensitive RF-016 error data: %s", url => {
    expect(isSensitiveRequest(url)).toBe(true);
  });

  it.each([
    undefined,
    "/auth-other/login",
    "/security-other/2fa",
    "/audit-logs-other",
    "/users/11",
    "/users/11/2fa-other",
    "/users/11?next=/security/2fa",
    "/settings/slaMinutes"
  ])("preserves other endpoint diagnostics: %s", url => {
    expect(isSensitiveRequest(url)).toBe(false);
  });
});

describe("attachment request telemetry", () => {
  it.each([
    "/tickets/301/attachments",
    "/tickets/301/attachments?kind=pdf&cursor=fictitious",
    "/tickets/301/attachments/302/fixture-message/content",
    "/Tickets/301/Attachments/302/fixture-message",
    "/tickets/301/%61ttachments?bad=%XX",
    "/tickets/301%2Fextra/%61ttachments/302/fixture-message/content",
    "/tickets/301%XX/%61ttachments",
    "https://example.invalid/backend/tickets/301/attachments"
  ])("keeps rejected attachment data out of telemetry: %s", url => {
    expect(isSensitiveRequest(url)).toBe(true);
  });

  it.each([
    undefined,
    "/tickets/301",
    "/tickets/301/attachments-other",
    "/contacts"
  ])("preserves unrelated diagnostics: %s", url =>
    expect(isSensitiveRequest(url)).toBe(false)
  );
});

describe("Acessorias request telemetry", () => {
  it.each([
    "/tickets/301/acessorias/status",
    "/tickets/301/acessorias/catalog",
    "/tickets/301/acessorias/links/mock-001",
    "/tickets/301/acessorias/clients/mock-001?page=2",
    "/Tickets/301/Acessorias/links?bad=%XX",
    "/tickets/301/%61cessorias/links?bad=%XX",
    "/tickets/1%2Fextra/acessorias/links",
    "/tickets/1%2Fextra/%61cessorias/links?bad=%XX",
    "/tickets/1%XX/%61cessorias/links",
    "/settings/acessoriasEnabled",
    "/Settings/%61cessoriasEnabled?bad=%XX"
  ])("excludes bodies even when rejected: %s", url => {
    expect(isAcessoriasRequest(url)).toBe(true);
    expect(isSensitiveRequest(url)).toBe(true);
  });
  it.each([undefined, "/tickets/301", "/contacts", "/settings/slaMinutes"])(
    "keeps unrelated diagnostics: %s",
    url => expect(isAcessoriasRequest(url)).toBe(false)
  );
});

describe("assistant request telemetry", () => {
  it.each([
    "/tickets/301/assistant",
    "/tickets/301/assistant/status",
    "https://example.invalid/backend/tickets/301/assistant",
    "/Tickets/301/Assistant?bad=%XX",
    "/tickets/301/%61ssistant?bad=%XX",
    "/tickets/1%2Fextra/assistant",
    "/tickets/1%2Fextra/%61ssistant?bad=%XX",
    "/tickets/1%XX/%61ssistant",
    "/settings/aiAssistantEnabled",
    "/Settings/%61iAssistantEnabled?bad=%XX"
  ])("excludes rejected request bodies as well as valid ones: %s", url => {
    expect(isAssistantRequest(url)).toBe(true);
    expect(isSensitiveRequest(url)).toBe(true);
  });

  it.each([undefined, "/tickets/301", "/messages/301", "/settings/slaMinutes"])(
    "preserves unrelated error diagnostics: %s",
    url => {
      expect(isAssistantRequest(url)).toBe(false);
      expect(isSensitiveRequest(url)).toBe(false);
    }
  );
});
