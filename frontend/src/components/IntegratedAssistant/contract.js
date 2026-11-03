export const PROVIDERS = ["acessorias", "sci"];
export const WARNINGS = [
  "SIMULATED",
  "REVIEW_REQUIRED",
  "PARTIAL_CONTEXT",
  "NO_MESSAGES",
  "INSUFFICIENT_INFORMATION",
  "PARTIAL_SOURCES",
  "STALE_SOURCES",
  "PARTIAL_PAGES"
];
const object = value =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) =>
  object(value) &&
  Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const text = (value, max) =>
  typeof value === "string" && !!value.trim() && value.length <= max;
const id = value =>
  typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const iso = value =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const mode = value => ["mock", "disabled"].includes(value);
const sourceError = (value, provider) =>
  typeof value === "string" &&
  value.startsWith(`ERR_${provider.toUpperCase()}_`) &&
  /^ERR_(ACESSORIAS|SCI)_(DISABLED|CLIENT_NOT_FOUND|FUNCTIONAL_ERROR|INVALID_OUTPUT|UPSTREAM_UNAUTHORIZED|RATE_LIMITED|TIMEOUT|UNAVAILABLE)$/.test(
    value
  );
const client = value =>
  exact(value, ["externalClientId", "name", "documentLabel"]) &&
  id(value.externalClientId) &&
  text(value.name, 160) &&
  text(value.documentLabel, 120);
const source = (value, provider) =>
  exact(value, ["provider", "label", "fetchedAt", "updatedAt", "stale"]) &&
  value.provider === provider &&
  value.label ===
    (provider === "sci"
      ? "Simulação local SCI"
      : "Simulação local Acessórias") &&
  iso(value.fetchedAt) &&
  iso(value.updatedAt) &&
  Date.parse(value.updatedAt) <= Date.parse(value.fetchedAt) &&
  typeof value.stale === "boolean";
const mock = value => value?.mode === "mock" && value.simulated === true;

export const validStatus = value =>
  exact(value, [
    "enabled",
    "mode",
    "simulated",
    "reason",
    "requiresReview",
    "limits",
    "providers"
  ]) &&
  typeof value.enabled === "boolean" &&
  mode(value.mode) &&
  value.simulated === true &&
  value.requiresReview === true &&
  (value.enabled
    ? value.mode === "mock" && value.reason === null
    : ["SERVER_DISABLED", "COMPANY_DISABLED", "ASSISTANT_DISABLED"].includes(
        value.reason
      )) &&
  exact(value.limits, [
    "maxMessages",
    "maxCharacters",
    "pageSize",
    "maxPage"
  ]) &&
  value.limits.maxMessages === 30 &&
  value.limits.maxCharacters === 12000 &&
  value.limits.pageSize === 5 &&
  value.limits.maxPage === 100 &&
  exact(value.providers, PROVIDERS) &&
  PROVIDERS.every(provider => {
    const state = value.providers[provider];
    return (
      exact(state, ["enabled", "mode", "reason"]) &&
      typeof state.enabled === "boolean" &&
      mode(state.mode) &&
      (state.enabled
        ? state.mode === "mock" && state.reason === null
        : ["SERVER_DISABLED", "COMPANY_DISABLED"].includes(state.reason))
    );
  });

export const validClients = value =>
  exact(value, ["mode", "simulated", "providers"]) &&
  mock(value) &&
  exact(value.providers, PROVIDERS) &&
  PROVIDERS.every(provider => {
    const item = value.providers[provider];
    if (
      !exact(item, ["state", "clients", "source", "errorCode"]) ||
      !Array.isArray(item.clients) ||
      item.clients.length > 20
    )
      return false;
    if (item.state === "ready")
      return (
        item.errorCode === null &&
        item.clients.every(client) &&
        new Set(item.clients.map(row => row.externalClientId)).size ===
          item.clients.length &&
        source(item.source, provider)
      );
    return (
      ["disabled", "error"].includes(item.state) &&
      item.clients.length === 0 &&
      item.source === null &&
      sourceError(item.errorCode, provider)
    );
  });

const validDetail = (value, provider, selection) => {
  const itemsKey = provider === "sci" ? "publications" : "pendingItems";
  if (
    !exact(value, [
      "mode",
      "simulated",
      "client",
      itemsKey,
      "pagination",
      "source"
    ]) ||
    !mock(value) ||
    !client(value.client) ||
    value.client.externalClientId !== selection.externalClientId ||
    !source(value.source, provider) ||
    !exact(value.pagination, ["page", "pageSize", "total", "hasMore"]) ||
    value.pagination.page !== selection.page ||
    value.pagination.pageSize !== 5 ||
    !Number.isSafeInteger(value.pagination.total) ||
    value.pagination.total < 0 ||
    value.pagination.total > 500 ||
    typeof value.pagination.hasMore !== "boolean" ||
    !Array.isArray(value[itemsKey])
  )
    return false;
  const { page, total } = value.pagination;
  const items = value[itemsKey];
  return (
    items.length === Math.min(5, Math.max(0, total - (page - 1) * 5)) &&
    value.pagination.hasMore === page * 5 < total &&
    new Set(items.map(item => item.id)).size === items.length &&
    items.every(item => {
      if (provider === "sci")
        return (
          exact(item, [
            "id",
            "title",
            "categoryLabel",
            "periodLabel",
            "publishedAt"
          ]) &&
          text(item.id, 100) &&
          text(item.title, 200) &&
          text(item.categoryLabel, 100) &&
          text(item.periodLabel, 100) &&
          iso(item.publishedAt) &&
          Date.parse(item.publishedAt) <= Date.parse(value.source.fetchedAt)
        );
      return (
        exact(item, ["id", "title", "status", "periodLabel", "dueLabel"]) &&
        text(item.id, 100) &&
        text(item.title, 200) &&
        item.status === "pending" &&
        text(item.periodLabel, 100) &&
        text(item.dueLabel, 100)
      );
    })
  );
};

export const validResult = (value, ticketId, contactId, kind, selections) =>
  exact(value, [
    "ticketId",
    "contactId",
    "kind",
    "mode",
    "simulated",
    "requiresReview",
    "text",
    "references",
    "context",
    "sources",
    "warnings",
    "generatedAt",
    "contextVersion"
  ]) &&
  mock(value) &&
  value.requiresReview === true &&
  Number(value.ticketId) === Number(ticketId) &&
  Number(value.contactId) === Number(contactId) &&
  value.kind === kind &&
  text(value.text, 12000) &&
  iso(value.generatedAt) &&
  /^[a-f0-9]{64}$/.test(value.contextVersion) &&
  Array.isArray(value.references) &&
  value.references.length <= 30 &&
  value.references.every(
    ref =>
      exact(ref, ["messageId", "excerpt"]) &&
      text(ref.messageId, 256) &&
      typeof ref.excerpt === "string" &&
      ref.excerpt.length <= 320
  ) &&
  new Set(value.references.map(ref => ref.messageId)).size ===
    value.references.length &&
  exact(value.context, [
    "maxMessages",
    "maxCharacters",
    "messageCount",
    "characterCount",
    "partial"
  ]) &&
  value.context.maxMessages === 30 &&
  value.context.maxCharacters === 12000 &&
  Number.isInteger(value.context.messageCount) &&
  value.context.messageCount >= 0 &&
  value.context.messageCount <= 30 &&
  Number.isInteger(value.context.characterCount) &&
  value.context.characterCount >= 0 &&
  value.context.characterCount <= 12000 &&
  typeof value.context.partial === "boolean" &&
  Array.isArray(value.warnings) &&
  value.warnings.length <= WARNINGS.length &&
  new Set(value.warnings).size === value.warnings.length &&
  value.warnings.every(warning => WARNINGS.includes(warning)) &&
  value.warnings.includes("SIMULATED") &&
  value.warnings.includes("REVIEW_REQUIRED") &&
  exact(value.sources, PROVIDERS) &&
  PROVIDERS.every(provider => {
    const item = value.sources[provider];
    if (!exact(item, ["state", "data", "errorCode"])) return false;
    if (selections[provider] === null)
      return (
        item.state === "notSelected" &&
        item.data === null &&
        item.errorCode === null
      );
    if (item.state === "error")
      return item.data === null && sourceError(item.errorCode, provider);
    return (
      item.state === "ready" &&
      item.errorCode === null &&
      validDetail(item.data, provider, selections[provider])
    );
  });

export const validReview = value =>
  exact(value, ["valid", "mode", "simulated"]) &&
  mock(value) &&
  value.valid === true;
