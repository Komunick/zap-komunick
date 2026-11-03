import { createHash } from "crypto";
import AppError from "../errors/AppError";
import {
  ASSISTANT_LIMITS,
  AssistantContext,
  AssistantKind,
  AssistantMessage,
  createMockAssistantOutput
} from "./AssistantRules";
import {
  AcessoriasClient,
  AcessoriasDetail,
  AcessoriasSource,
  validateAcessoriasCatalog,
  validateAcessoriasDetail
} from "./AcessoriasRules";
import {
  SciClient,
  SciDetail,
  SciSource,
  validateSciCatalog,
  validateSciDetail
} from "./SciRules";

export const INTEGRATED_ASSISTANT_LIMITS = {
  ...ASSISTANT_LIMITS,
  pageSize: 5,
  maxPage: 100
};
export const INTEGRATED_PROVIDERS = ["acessorias", "sci"] as const;
export type IntegratedProvider = (typeof INTEGRATED_PROVIDERS)[number];
export interface IntegratedSelection {
  externalClientId: string;
  page: number;
}
export type IntegratedSelections = Record<
  IntegratedProvider,
  IntegratedSelection | null
>;
export interface IntegratedRequest {
  kind: AssistantKind;
  sources: IntegratedSelections;
}
export interface IntegratedReviewRequest extends IntegratedRequest {
  kind: "reply";
  contextVersion: string;
}
export type IntegratedDetail =
  | ({ mode: "mock"; simulated: true } & Omit<AcessoriasDetail, "companyId">)
  | ({ mode: "mock"; simulated: true } & Omit<SciDetail, "companyId">);
export interface IntegratedSource {
  state: "ready" | "error" | "notSelected";
  data: IntegratedDetail | null;
  errorCode: string | null;
}
export type IntegratedSources = Record<IntegratedProvider, IntegratedSource>;
export interface IntegratedClientsEnvelope {
  state: "ready" | "disabled" | "error";
  clients: (AcessoriasClient | SciClient)[];
  source: AcessoriasSource | SciSource | null;
  errorCode: string | null;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]): boolean =>
  Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const invalid = (): never => {
  throw new AppError("ERR_INTEGRATED_ASSISTANT_INVALID_REQUEST", 400);
};
const invalidOutput = (): never => {
  throw new AppError("ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT", 502);
};
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const integratedAssistantMode = (): "disabled" | "mock" =>
  process.env.INTEGRATED_ASSISTANT_MODE === "mock" ? "mock" : "disabled";

const parseSources = (value: unknown): IntegratedSelections => {
  if (!object(value) || !keys(value, [...INTEGRATED_PROVIDERS]))
    return invalid();
  const sources = {} as IntegratedSelections;
  INTEGRATED_PROVIDERS.forEach(provider => {
    const selection = value[provider];
    if (selection === null) {
      sources[provider] = null;
      return;
    }
    if (
      !object(selection) ||
      !keys(selection, ["externalClientId", "page"]) ||
      typeof selection.externalClientId !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(selection.externalClientId) ||
      !Number.isSafeInteger(selection.page) ||
      Number(selection.page) < 1 ||
      Number(selection.page) > INTEGRATED_ASSISTANT_LIMITS.maxPage
    )
      return invalid();
    sources[provider] = {
      externalClientId: selection.externalClientId,
      page: Number(selection.page)
    };
  });
  if (!INTEGRATED_PROVIDERS.some(provider => sources[provider] !== null))
    return invalid();
  return sources;
};

export const parseIntegratedRequest = (input: unknown): IntegratedRequest => {
  if (
    !object(input) ||
    !keys(input, ["kind", "sources"]) ||
    typeof input.kind !== "string" ||
    !["summary", "reply"].includes(input.kind)
  )
    return invalid();
  return {
    kind: input.kind as AssistantKind,
    sources: parseSources(input.sources)
  };
};
export const parseIntegratedReviewRequest = (
  input: unknown
): IntegratedReviewRequest => {
  if (
    !object(input) ||
    !keys(input, ["kind", "sources", "contextVersion"]) ||
    input.kind !== "reply" ||
    typeof input.contextVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.contextVersion)
  )
    return invalid();
  return {
    kind: "reply",
    sources: parseSources(input.sources),
    contextVersion: input.contextVersion
  };
};
export const requireEmptyIntegratedQuery = (
  query: Record<string, unknown>
): void => {
  if (Object.keys(query).length) invalid();
};

// This is only a stale-context comparison. It never substitutes for authorization.
export const integratedContextVersion = (snapshot: unknown): string =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

export const normalizeIntegratedClients = (
  provider: IntegratedProvider,
  input: unknown,
  companyId: number
): IntegratedClientsEnvelope => {
  if (
    !object(input) ||
    !keys(input, ["mode", "simulated", "clients", "source"]) ||
    input.mode !== "mock" ||
    input.simulated !== true
  )
    return invalidOutput();
  const candidate = { companyId, clients: input.clients, source: input.source };
  const valid =
    provider === "acessorias"
      ? validateAcessoriasCatalog(candidate, companyId)
      : validateSciCatalog(candidate, companyId);
  return copy({
    state: "ready" as const,
    clients: valid.clients,
    source: valid.source,
    errorCode: null
  });
};

export const normalizeIntegratedDetail = (
  provider: IntegratedProvider,
  input: unknown,
  companyId: number,
  selection: IntegratedSelection
): IntegratedDetail => {
  if (
    !object(input) ||
    !keys(input, [
      "mode",
      "simulated",
      "client",
      provider === "acessorias" ? "pendingItems" : "publications",
      "pagination",
      "source"
    ]) ||
    input.mode !== "mock" ||
    input.simulated !== true
  )
    return invalidOutput();
  const fields = {
    client: input.client,
    pagination: input.pagination,
    source: input.source,
    ...(provider === "acessorias"
      ? { pendingItems: input.pendingItems }
      : { publications: input.publications })
  };
  const valid =
    provider === "acessorias"
      ? validateAcessoriasDetail(
          { companyId, ...fields },
          companyId,
          selection.externalClientId,
          selection.page
        )
      : validateSciDetail(
          { companyId, ...fields },
          companyId,
          selection.externalClientId,
          selection.page
        );
  return copy({
    mode: "mock",
    simulated: true,
    client: valid.client,
    pagination: valid.pagination,
    source: valid.source,
    ...("pendingItems" in valid
      ? { pendingItems: valid.pendingItems }
      : { publications: valid.publications })
  }) as IntegratedDetail;
};

const operational = new Set([
  "FUNCTIONAL_ERROR",
  "INVALID_OUTPUT",
  "UPSTREAM_UNAUTHORIZED",
  "RATE_LIMITED",
  "TIMEOUT",
  "UNAVAILABLE",
  "CLIENT_NOT_FOUND"
]);
export const integratedOperationalError = (
  provider: IntegratedProvider,
  error: unknown
): string | undefined => {
  if (!(error instanceof AppError)) return undefined;
  const prefix = provider === "acessorias" ? "ERR_ACESSORIAS_" : "ERR_SCI_";
  return error.message.startsWith(prefix) &&
    operational.has(error.message.slice(prefix.length))
    ? error.message
    : undefined;
};

export const integratedWarnings = (
  kind: AssistantKind,
  context: AssistantContext,
  sources: IntegratedSources
): string[] => [
  "SIMULATED",
  "REVIEW_REQUIRED",
  ...(context.partial ? ["PARTIAL_CONTEXT"] : []),
  ...(!context.messageCount ? ["NO_MESSAGES"] : []),
  ...(kind === "reply" ? ["INSUFFICIENT_INFORMATION"] : []),
  ...(INTEGRATED_PROVIDERS.some(provider => sources[provider].state === "error")
    ? ["PARTIAL_SOURCES"]
    : []),
  ...(INTEGRATED_PROVIDERS.some(
    provider => sources[provider].data?.source.stale
  )
    ? ["STALE_SOURCES"]
    : []),
  ...(INTEGRATED_PROVIDERS.some(provider => {
    const page = sources[provider].data?.pagination;
    return page && (page.hasMore || page.page > 1);
  })
    ? ["PARTIAL_PAGES"]
    : [])
];

// A deterministic simulation quotes metadata as untrusted data. It never follows
// instructions in messages/titles or confirms a tax obligation, deadline or payment.
export const createIntegratedText = (
  kind: AssistantKind,
  messages: AssistantMessage[],
  sources: IntegratedSources
): string => {
  const conversation = createMockAssistantOutput(kind, messages).text;
  const sections: string[] = [];
  INTEGRATED_PROVIDERS.forEach(provider => {
    const source = sources[provider];
    if (source.state === "notSelected") return;
    const label = provider === "acessorias" ? "Acessórias" : "SCI";
    if (source.state === "error") {
      sections.push(
        `${label}: não foi possível obter os dados simulados nesta consulta.`
      );
      return;
    }
    const data = source.data;
    if (!data) return invalidOutput();
    const items =
      "pendingItems" in data ? data.pendingItems : data.publications;
    sections.push(
      [
        `${data.source.label}. Cliente fictício (citação): ${JSON.stringify(data.client.name)}.`,
        `Página ${data.pagination.page}: ${items.length} itens fictícios exibidos; total informado pela simulação: ${data.pagination.total}.`,
        ...items.map(
          item => `Metadado fictício (citação): ${JSON.stringify(item.title)}.`
        ),
        `Origem atualizada em ${data.source.updatedAt}; consultada em ${data.source.fetchedAt}.`,
        ...(data.source.stale
          ? ["Dados desatualizados na simulação; conferir antes de usar."]
          : [])
      ].join("\n")
    );
  });
  const text = [
    conversation,
    ...sections,
    "Simulação sujeita à revisão humana. Estes dados não confirmam documentos, obrigações, prazos ou pagamentos."
  ].join("\n\n");
  if (text.length > 12000) return invalidOutput();
  return text;
};
