import {
  parseAcessoriasLink,
  parseAcessoriasPage,
  parseExternalClientId,
  requireEmptyAcessoriasQuery,
  unwrapAcessoriasMock,
  validateAcessoriasCatalog,
  validateAcessoriasDetail
} from "../../helpers/AcessoriasRules";
import { requestMockAcessorias } from "../../services/AcessoriasServices/MockAcessoriasProvider";

describe("Acessórias internal mock contract", () => {
  it.each(
    [
      null,
      {},
      [],
      { externalClientId: "mock-001", companyId: 20 },
      { externalClientId: "mock-001", contactId: 2 },
      { externalClientId: "mock-001", provider: "other" }
    ].map(input => [input])
  )("rejects authority fields in local link requests", input => {
    expect(() => parseAcessoriasLink(input)).toThrow(
      "ERR_ACESSORIAS_INVALID_REQUEST"
    );
  });
  it.each([
    null,
    "",
    "MOCK-001",
    "../client",
    "id/other",
    "00.000.000/0000-00",
    "x".repeat(65)
  ])(
    "does not use a document, phone or arbitrary path as authorization",
    input => {
      expect(() => parseExternalClientId(input)).toThrow(
        "ERR_ACESSORIAS_INVALID_REQUEST"
      );
    }
  );
  it("accepts explicit IDs and only a bounded page query", () => {
    expect(parseAcessoriasLink({ externalClientId: "mock-001" })).toBe(
      "mock-001"
    );
    expect(parseAcessoriasPage({})).toBe(1);
    expect(parseAcessoriasPage({ page: "100" })).toBe(100);
    requireEmptyAcessoriasQuery({});
  });
  it.each([
    { page: "0" },
    { page: "101" },
    { page: "1.2" },
    { page: "01" },
    { page: "Infinity" },
    { page: ["1", "2"] },
    { page: 1 },
    { companyId: "20" },
    { page: "1", contactId: "2" }
  ])("rejects invalid or authority-bearing queries", query => {
    expect(() => parseAcessoriasPage(query)).toThrow(
      "ERR_ACESSORIAS_INVALID_REQUEST"
    );
    expect(() => requireEmptyAcessoriasQuery(query)).toThrow(
      "ERR_ACESSORIAS_INVALID_REQUEST"
    );
  });

  it("keeps identical external IDs in separate synthetic company namespaces", async () => {
    const first = validateAcessoriasCatalog(
      unwrapAcessoriasMock(
        await requestMockAcessorias({ operation: "catalog", companyId: 10 })
      ),
      10
    );
    const other = validateAcessoriasCatalog(
      unwrapAcessoriasMock(
        await requestMockAcessorias({ operation: "catalog", companyId: 20 })
      ),
      20
    );
    expect(first.clients.map(client => client.externalClientId)).toEqual(
      other.clients.map(client => client.externalClientId)
    );
    expect(first.clients).toHaveLength(7);
    expect(first.clients[0].name).toBe(
      "Empresa fictícia 001 — escritório simulado 10"
    );
    expect(other.clients[0].name).toBe(
      "Empresa fictícia 001 — escritório simulado 20"
    );
    expect(
      first.clients.every(
        client =>
          client.documentLabel === "CNPJ fictício inválido: 00.000.000/0000-00"
      )
    ).toBe(true);
    expect(() => validateAcessoriasCatalog(other, 10)).toThrow(
      "ERR_ACESSORIAS_INVALID_OUTPUT"
    );
  });

  it("paginates twelve synthetic pending records without duplicate or missing IDs", async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map(async page =>
        validateAcessoriasDetail(
          unwrapAcessoriasMock(
            await requestMockAcessorias({
              operation: "detail",
              companyId: 10,
              externalClientId: "mock-001",
              page
            })
          ),
          10,
          "mock-001",
          page
        )
      )
    );
    expect(pages.map(result => result.pendingItems.length)).toEqual([
      5, 5, 2, 0
    ]);
    expect(pages.map(result => result.pagination.hasMore)).toEqual([
      true,
      true,
      false,
      false
    ]);
    expect(pages.every(result => result.pagination.total === 12)).toBe(true);
    expect(
      pages.flatMap(result => result.pendingItems.map(item => item.id))
    ).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `mock-001-item-${String(index + 1).padStart(2, "0")}`
      )
    );
    expect(pages[0].pendingItems[0]).toEqual({
      id: "mock-001-item-01",
      title: "Pendência fictícia 1 — escritório simulado 10",
      status: "pending",
      periodLabel: "Competência simulada 1",
      dueLabel: "Prazo não confirmado (simulação)"
    });
  });

  it("keeps empty and stale success states distinct", async () => {
    const empty = validateAcessoriasDetail(
      unwrapAcessoriasMock(
        await requestMockAcessorias({
          operation: "detail",
          companyId: 10,
          externalClientId: "mock-002",
          page: 1
        })
      ),
      10,
      "mock-002",
      1
    );
    expect(empty.pendingItems).toEqual([]);
    expect(empty.pagination.total).toBe(0);
    expect(empty.source.stale).toBe(false);
    const stale = validateAcessoriasDetail(
      unwrapAcessoriasMock(
        await requestMockAcessorias({
          operation: "detail",
          companyId: 10,
          externalClientId: "mock-stale",
          page: 1
        })
      ),
      10,
      "mock-stale",
      1
    );
    expect(stale.pendingItems).toHaveLength(2);
    expect(stale.source.stale).toBe(true);
    expect(Date.parse(stale.source.updatedAt)).toBeLessThan(
      Date.parse(stale.source.fetchedAt)
    );
  });

  it.each([
    [
      200,
      { Erro: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_ACESSORIAS_FUNCTIONAL_ERROR",
      502
    ],
    [
      401,
      { detail: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_ACESSORIAS_UPSTREAM_UNAUTHORIZED",
      502
    ],
    [
      429,
      { detail: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_ACESSORIAS_RATE_LIMITED",
      429
    ],
    [
      500,
      { detail: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_ACESSORIAS_UNAVAILABLE",
      503
    ]
  ])(
    "maps simulated transport status %s to a safe code",
    (status, payload, code, expectedStatus) => {
      let caught;
      try {
        unwrapAcessoriasMock({ status: status as number, payload });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({
        message: code,
        statusCode: expectedStatus
      });
      expect(JSON.stringify(caught)).not.toContain("FICTITIOUS_VENDOR_DETAIL");
    }
  );

  it("rejects malformed, cross-client and cross-company detail payloads and invalid freshness", async () => {
    const good = validateAcessoriasDetail(
      unwrapAcessoriasMock(
        await requestMockAcessorias({
          operation: "detail",
          companyId: 10,
          externalClientId: "mock-001",
          page: 1
        })
      ),
      10,
      "mock-001",
      1
    );
    const clone = () => JSON.parse(JSON.stringify(good));
    const cases = [
      { ...good, companyId: 20 },
      { ...good, internalToken: "private" },
      { ...good, client: { ...good.client, externalClientId: "mock-002" } },
      { ...good, source: { ...good.source, stale: "true" } },
      {
        ...good,
        source: { ...good.source, updatedAt: "+010000-01-01T00:00:00.000Z" }
      },
      { ...good, source: { ...good.source, fetchedAt: "invalid" } },
      { ...good, pagination: { ...good.pagination, hasMore: false } }
    ];
    const foreign = clone();
    foreign.pendingItems[0].id = "mock-002-item-01";
    cases.push(foreign);
    const duplicate = clone();
    duplicate.pendingItems[1].id = duplicate.pendingItems[0].id;
    cases.push(duplicate);
    cases.forEach(input =>
      expect(() => validateAcessoriasDetail(input, 10, "mock-001", 1)).toThrow(
        "ERR_ACESSORIAS_INVALID_OUTPUT"
      )
    );
  });
});
