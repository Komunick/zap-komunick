import AppError from "../errors/AppError";

// P3 internal simulation contract. These fields and limits are not a vendor API contract.
export const SCI_LIMITS = { pageSize: 5, maxPage: 100 };
export const SCI_PROVIDER = "sci";
export const SCI_SOURCE_LABEL = "Simulação local SCI";
export interface SciClient {
  externalClientId: string;
  name: string;
  documentLabel: string;
}
export interface SciSource {
  provider: "sci";
  label: string;
  fetchedAt: string;
  updatedAt: string;
  stale: boolean;
}
export interface SciPublication {
  id: string;
  title: string;
  categoryLabel: string;
  periodLabel: string;
  publishedAt: string;
}
export interface SciCatalog {
  companyId: number;
  clients: SciClient[];
  source: SciSource;
}
export interface SciDetail {
  companyId: number;
  client: SciClient;
  publications: SciPublication[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  source: SciSource;
}

export const sciMode = (): "disabled" | "mock" =>
  process.env.SCI_MODE === "mock" ? "mock" : "disabled";

export const parseExternalClientId = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
  }
  return value;
};

export const parseSciLink = (input: unknown): string => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input, "externalClientId")
  ) {
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
  }
  return parseExternalClientId(
    (input as { externalClientId: unknown }).externalClientId
  );
};

export const parseSciPage = (query: Record<string, unknown>): number => {
  if (Object.keys(query).some(key => key !== "page")) {
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
  }
  if (query.page === undefined) return 1;
  if (
    typeof query.page !== "string" ||
    !/^[1-9]\d*$/.test(query.page) ||
    Number(query.page) > SCI_LIMITS.maxPage
  ) {
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
  }
  return Number(query.page);
};

export const requireEmptySciQuery = (query: Record<string, unknown>): void => {
  if (Object.keys(query).length)
    throw new AppError("ERR_SCI_INVALID_REQUEST", 400);
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

const validSource = (value: unknown): value is SciSource =>
  object(value) &&
  keys(value, ["provider", "label", "fetchedAt", "updatedAt", "stale"]) &&
  value.provider === SCI_PROVIDER &&
  value.label === SCI_SOURCE_LABEL &&
  iso(value.fetchedAt) &&
  iso(value.updatedAt) &&
  Date.parse(value.updatedAt) <= Date.parse(value.fetchedAt) &&
  typeof value.stale === "boolean";

const validClient = (value: unknown): value is SciClient =>
  object(value) &&
  keys(value, ["externalClientId", "name", "documentLabel"]) &&
  typeof value.externalClientId === "string" &&
  /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.externalClientId) &&
  text(value.name, 160) &&
  text(value.documentLabel, 120);

const invalidOutput = (): never => {
  throw new AppError("ERR_SCI_INVALID_OUTPUT", 502);
};

export const validateSciCatalog = (
  input: unknown,
  companyId: number
): SciCatalog => {
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
  return input as unknown as SciCatalog;
};

export const validateSciDetail = (
  input: unknown,
  companyId: number,
  externalClientId: string,
  page: number
): SciDetail => {
  if (
    !object(input) ||
    !keys(input, [
      "companyId",
      "client",
      "publications",
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
    input.pagination.pageSize !== SCI_LIMITS.pageSize ||
    !Number.isSafeInteger(input.pagination.total) ||
    Number(input.pagination.total) < 0 ||
    Number(input.pagination.total) > 500 ||
    typeof input.pagination.hasMore !== "boolean" ||
    !Array.isArray(input.publications) ||
    input.publications.length > SCI_LIMITS.pageSize
  ) {
    return invalidOutput();
  }
  const total = Number(input.pagination.total);
  const fetchedAt = Date.parse(input.source.fetchedAt);
  if (
    input.pagination.hasMore !== page * SCI_LIMITS.pageSize < total ||
    input.publications.length !==
      Math.min(
        SCI_LIMITS.pageSize,
        Math.max(0, total - (page - 1) * SCI_LIMITS.pageSize)
      ) ||
    !input.publications.every(
      (item, index) =>
        object(item) &&
        keys(item, [
          "id",
          "title",
          "categoryLabel",
          "periodLabel",
          "publishedAt"
        ]) &&
        text(item.id, 100) &&
        item.id ===
          `${externalClientId}-item-${String((page - 1) * SCI_LIMITS.pageSize + index + 1).padStart(2, "0")}` &&
        text(item.title, 200) &&
        text(item.categoryLabel, 100) &&
        text(item.periodLabel, 100) &&
        iso(item.publishedAt) &&
        Date.parse(item.publishedAt) <= fetchedAt
    ) ||
    new Set(input.publications.map(item => item.id)).size !==
      input.publications.length
  ) {
    return invalidOutput();
  }
  return input as unknown as SciDetail;
};

export interface MockSciResponse {
  status: number;
  payload: unknown;
}
export const unwrapSciMock = (response: MockSciResponse): unknown => {
  if (!response || !Number.isInteger(response.status)) return invalidOutput();
  if (response.status === 401)
    throw new AppError("ERR_SCI_UPSTREAM_UNAUTHORIZED", 502);
  if (response.status === 429) throw new AppError("ERR_SCI_RATE_LIMITED", 429);
  if (response.status !== 200) throw new AppError("ERR_SCI_UNAVAILABLE", 503);
  if (
    object(response.payload) &&
    Object.prototype.hasOwnProperty.call(response.payload, "Erro")
  ) {
    throw new AppError("ERR_SCI_FUNCTIONAL_ERROR", 502);
  }
  return response.payload;
};
