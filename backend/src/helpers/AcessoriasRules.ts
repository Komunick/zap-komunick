import AppError from "../errors/AppError";

// P2 internal simulation contract. These fields and limits are not a vendor API contract.
export const ACESSORIAS_LIMITS = { pageSize: 5, maxPage: 100 };
export const ACESSORIAS_PROVIDER = "acessorias";
export const ACESSORIAS_SOURCE_LABEL = "Simulação local Acessórias";
export interface AcessoriasClient {
  externalClientId: string;
  name: string;
  documentLabel: string;
}
export interface AcessoriasSource {
  provider: "acessorias";
  label: string;
  fetchedAt: string;
  updatedAt: string;
  stale: boolean;
}
export interface AcessoriasPending {
  id: string;
  title: string;
  status: "pending";
  periodLabel: string;
  dueLabel: string;
}
export interface AcessoriasCatalog {
  companyId: number;
  clients: AcessoriasClient[];
  source: AcessoriasSource;
}
export interface AcessoriasDetail {
  companyId: number;
  client: AcessoriasClient;
  pendingItems: AcessoriasPending[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  source: AcessoriasSource;
}

export const acessoriasMode = (): "disabled" | "mock" =>
  process.env.ACESSORIAS_MODE === "mock" ? "mock" : "disabled";

export const parseExternalClientId = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
  }
  return value;
};

export const parseAcessoriasLink = (input: unknown): string => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "externalClientId")
  ) {
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
  }
  return parseExternalClientId(
    (input as { externalClientId: unknown }).externalClientId
  );
};

export const parseAcessoriasPage = (query: Record<string, unknown>): number => {
  if (Object.keys(query).some(key => key !== "page")) {
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
  }
  if (query.page === undefined) return 1;
  if (
    typeof query.page !== "string" ||
    !/^[1-9]\d*$/.test(query.page) ||
    Number(query.page) > ACESSORIAS_LIMITS.maxPage
  ) {
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
  }
  return Number(query.page);
};

export const requireEmptyAcessoriasQuery = (
  query: Record<string, unknown>
): void => {
  if (Object.keys(query).length)
    throw new AppError("ERR_ACESSORIAS_INVALID_REQUEST", 400);
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]): boolean =>
  Object.keys(value).sort().join(",") === expected.sort().join(",");
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max;
const iso = (value: unknown): value is string =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const validSource = (value: unknown): value is AcessoriasSource =>
  object(value) &&
  keys(value, ["provider", "label", "fetchedAt", "updatedAt", "stale"]) &&
  value.provider === ACESSORIAS_PROVIDER &&
  value.label === ACESSORIAS_SOURCE_LABEL &&
  iso(value.fetchedAt) &&
  iso(value.updatedAt) &&
  Date.parse(value.updatedAt) <= Date.parse(value.fetchedAt) &&
  typeof value.stale === "boolean";

const validClient = (value: unknown): value is AcessoriasClient =>
  object(value) &&
  keys(value, ["externalClientId", "name", "documentLabel"]) &&
  typeof value.externalClientId === "string" &&
  /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.externalClientId) &&
  text(value.name, 160) &&
  text(value.documentLabel, 120);

const invalidOutput = (): never => {
  throw new AppError("ERR_ACESSORIAS_INVALID_OUTPUT", 502);
};

export const validateAcessoriasCatalog = (
  input: unknown,
  companyId: number
): AcessoriasCatalog => {
  if (
    !object(input) ||
    !keys(input, ["companyId", "clients", "source"]) ||
    input.companyId !== companyId ||
    !Array.isArray(input.clients) ||
    input.clients.length > 20 ||
    !input.clients.every(validClient) ||
    new Set(input.clients.map(client => client.externalClientId)).size !==
      input.clients.length ||
    !validSource(input.source)
  ) {
    return invalidOutput();
  }
  return input as unknown as AcessoriasCatalog;
};

export const validateAcessoriasDetail = (
  input: unknown,
  companyId: number,
  externalClientId: string,
  page: number
): AcessoriasDetail => {
  if (
    !object(input) ||
    !keys(input, [
      "companyId",
      "client",
      "pendingItems",
      "pagination",
      "source"
    ]) ||
    input.companyId !== companyId ||
    !validClient(input.client) ||
    input.client.externalClientId !== externalClientId ||
    !validSource(input.source) ||
    !object(input.pagination) ||
    !keys(input.pagination, ["page", "pageSize", "total", "hasMore"]) ||
    input.pagination.page !== page ||
    input.pagination.pageSize !== ACESSORIAS_LIMITS.pageSize ||
    !Number.isSafeInteger(input.pagination.total) ||
    Number(input.pagination.total) < 0 ||
    Number(input.pagination.total) > 500 ||
    typeof input.pagination.hasMore !== "boolean" ||
    !Array.isArray(input.pendingItems) ||
    input.pendingItems.length > ACESSORIAS_LIMITS.pageSize
  ) {
    return invalidOutput();
  }
  const total = Number(input.pagination.total);
  if (
    input.pagination.hasMore !== page * ACESSORIAS_LIMITS.pageSize < total ||
    input.pendingItems.length !==
      Math.min(
        ACESSORIAS_LIMITS.pageSize,
        Math.max(0, total - (page - 1) * ACESSORIAS_LIMITS.pageSize)
      ) ||
    !input.pendingItems.every(
      (item, index) =>
        object(item) &&
        keys(item, ["id", "title", "status", "periodLabel", "dueLabel"]) &&
        text(item.id, 100) &&
        item.id ===
          `${externalClientId}-item-${String((page - 1) * ACESSORIAS_LIMITS.pageSize + index + 1).padStart(2, "0")}` &&
        text(item.title, 200) &&
        item.status === "pending" &&
        text(item.periodLabel, 100) &&
        text(item.dueLabel, 100)
    ) ||
    new Set(input.pendingItems.map(item => item.id)).size !==
      input.pendingItems.length
  ) {
    return invalidOutput();
  }
  return input as unknown as AcessoriasDetail;
};

export interface MockAcessoriasResponse {
  status: number;
  payload: unknown;
}
export const unwrapAcessoriasMock = (
  response: MockAcessoriasResponse
): unknown => {
  if (!response || !Number.isInteger(response.status)) return invalidOutput();
  if (response.status === 401)
    throw new AppError("ERR_ACESSORIAS_UPSTREAM_UNAUTHORIZED", 502);
  if (response.status === 429)
    throw new AppError("ERR_ACESSORIAS_RATE_LIMITED", 429);
  if (response.status !== 200)
    throw new AppError("ERR_ACESSORIAS_UNAVAILABLE", 503);
  if (
    object(response.payload) &&
    Object.prototype.hasOwnProperty.call(response.payload, "Erro")
  ) {
    throw new AppError("ERR_ACESSORIAS_FUNCTIONAL_ERROR", 502);
  }
  return response.payload;
};
