import {
  ACESSORIAS_LIMITS,
  ACESSORIAS_SOURCE_LABEL,
  AcessoriasClient,
  AcessoriasSource,
  MockAcessoriasResponse
} from "../../helpers/AcessoriasRules";

// Entirely synthetic, local fixtures. IDs intentionally repeat between company namespaces.
const entries = [
  ["mock-001", "Empresa fictícia 001"],
  ["mock-002", "Empresa fictícia 002 — sem pendências"],
  ["mock-stale", "Empresa fictícia — fonte desatualizada simulada"],
  ["mock-error200", "Teste fictício — erro funcional em HTTP 200"],
  ["mock-unauthorized", "Teste fictício — acesso recusado simulado"],
  ["mock-rate-limit", "Teste fictício — limite simulado"],
  ["mock-timeout", "Teste fictício — timeout simulado"]
];

const source = (stale = false): AcessoriasSource => {
  const now = new Date();
  return {
    provider: "acessorias",
    label: ACESSORIAS_SOURCE_LABEL,
    fetchedAt: now.toISOString(),
    updatedAt: new Date(now.getTime() - (stale ? 86400000 : 0)).toISOString(),
    stale
  };
};

const catalog = (companyId: number): AcessoriasClient[] =>
  entries.map(([externalClientId, name]) => ({
    externalClientId,
    name: `${name} — escritório simulado ${companyId}`,
    documentLabel: "CNPJ fictício inválido: 00.000.000/0000-00"
  }));

export interface MockAcessoriasRequest {
  operation: "catalog" | "detail";
  companyId: number;
  externalClientId?: string;
  page?: number;
}

// No HTTP client, SDK, token resolver, file, queue or cache is used by this provider.
export const requestMockAcessorias = async (
  request: MockAcessoriasRequest
): Promise<MockAcessoriasResponse> => {
  const clients = catalog(request.companyId);
  if (request.operation === "catalog")
    return {
      status: 200,
      payload: { companyId: request.companyId, clients, source: source() }
    };
  if (request.externalClientId === "mock-error200")
    return { status: 200, payload: { Erro: "Erro funcional fictício" } };
  if (request.externalClientId === "mock-unauthorized")
    return { status: 401, payload: null };
  if (request.externalClientId === "mock-rate-limit")
    return { status: 429, payload: null };
  if (request.externalClientId === "mock-timeout")
    return new Promise(() => undefined);
  const client = clients.find(
    item => item.externalClientId === request.externalClientId
  );
  if (!client) return { status: 404, payload: null };
  const total =
    client.externalClientId === "mock-002"
      ? 0
      : client.externalClientId === "mock-stale"
        ? 2
        : 12;
  const pending = Array.from({ length: total }, (_, index) => ({
    id: `${client.externalClientId}-item-${String(index + 1).padStart(2, "0")}`,
    title: `Pendência fictícia ${index + 1} — escritório simulado ${request.companyId}`,
    status: "pending",
    periodLabel: `Competência simulada ${index + 1}`,
    dueLabel: "Prazo não confirmado (simulação)"
  }));
  const page = request.page || 1;
  return {
    status: 200,
    payload: {
      companyId: request.companyId,
      client,
      pendingItems: pending.slice(
        (page - 1) * ACESSORIAS_LIMITS.pageSize,
        page * ACESSORIAS_LIMITS.pageSize
      ),
      pagination: {
        page,
        pageSize: ACESSORIAS_LIMITS.pageSize,
        total,
        hasMore: page * ACESSORIAS_LIMITS.pageSize < total
      },
      source: source(client.externalClientId === "mock-stale")
    }
  };
};
