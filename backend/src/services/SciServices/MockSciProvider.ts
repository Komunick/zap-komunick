import {
  SCI_LIMITS,
  SCI_SOURCE_LABEL,
  SciClient,
  SciSource,
  MockSciResponse
} from "../../helpers/SciRules";

// P3 is an internal simulation, not the contract of any SCI product or API.
const entries = [
  ["mock-001", "Cliente SCI fictício 001"],
  ["mock-002", "Cliente SCI fictício 002 — sem publicações"],
  ["mock-stale", "Cliente SCI fictício — fonte desatualizada simulada"],
  ["mock-unauthorized", "Teste fictício — acesso recusado simulado"],
  ["mock-rate-limit", "Teste fictício — limite simulado"],
  ["mock-timeout", "Teste fictício — timeout simulado"],
  ["mock-invalid-output", "Teste fictício — saída inválida simulada"]
];

const source = (stale = false): SciSource => {
  const now = new Date();
  return {
    provider: "sci",
    label: SCI_SOURCE_LABEL,
    fetchedAt: now.toISOString(),
    updatedAt: new Date(now.getTime() - (stale ? 86400000 : 0)).toISOString(),
    stale
  };
};

const catalog = (companyId: number): SciClient[] =>
  entries.map(([externalClientId, name]) => ({
    externalClientId,
    name: `${name} — escritório simulado ${companyId}`,
    documentLabel: "CNPJ fictício inválido: 00.000.000/0000-00"
  }));

export interface MockSciRequest {
  operation: "catalog" | "detail";
  companyId: number;
  externalClientId?: string;
  page?: number;
}

// No network, credential resolver, document, queue, cache or read-state write.
export const requestMockSci = async (
  request: MockSciRequest
): Promise<MockSciResponse> => {
  const clients = catalog(request.companyId);
  if (request.operation === "catalog")
    return {
      status: 200,
      payload: { companyId: request.companyId, clients, source: source() }
    };
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
  const publications = Array.from({ length: total }, (_, index) => ({
    id: `${client.externalClientId}-item-${String(index + 1).padStart(2, "0")}`,
    title: `Publicação fictícia ${index + 1} — escritório simulado ${request.companyId}`,
    categoryLabel: "Categoria fictícia: relatório demonstrativo",
    periodLabel: `Competência fictícia ${index + 1}`,
    publishedAt: new Date(Date.UTC(2026, 0, index + 1, 12)).toISOString()
  }));
  const page = request.page || 1;
  const visible = publications.slice(
    (page - 1) * SCI_LIMITS.pageSize,
    page * SCI_LIMITS.pageSize
  );
  if (client.externalClientId === "mock-invalid-output" && visible[0]) {
    // Intentional fixture: the validator must reject document URLs, never expose them.
    Object.assign(visible[0], { downloadUrl: "https://example.invalid/fictitious" });
  }
  const metadata = source(client.externalClientId === "mock-stale");
  if (client.externalClientId === "mock-invalid-output")
    Object.assign(metadata, { documentUrl: "https://example.invalid/fictitious" });
  return {
    status: 200,
    payload: {
      companyId: request.companyId,
      client,
      publications: visible,
      pagination: {
        page,
        pageSize: SCI_LIMITS.pageSize,
        total,
        hasMore: page * SCI_LIMITS.pageSize < total
      },
      source: metadata
    }
  };
};
