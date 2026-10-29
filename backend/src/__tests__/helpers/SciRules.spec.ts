import {
  parseSciLink,
  parseSciPage,
  parseExternalClientId,
  requireEmptySciQuery,
  unwrapSciMock,
  validateSciCatalog,
  validateSciDetail
} from "../../helpers/SciRules";
import { requestMockSci } from "../../services/SciServices/MockSciProvider";

describe("SCI internal mock contract", () => {
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
    expect(() => parseSciLink(input)).toThrow("ERR_SCI_INVALID_REQUEST");
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
        "ERR_SCI_INVALID_REQUEST"
      );
    }
  );
  it("accepts explicit IDs and only a bounded page query", () => {
    expect(parseSciLink({ externalClientId: "mock-001" })).toBe("mock-001");
    expect(parseSciPage({})).toBe(1);
    expect(parseSciPage({ page: "100" })).toBe(100);
    requireEmptySciQuery({});
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
    expect(() => parseSciPage(query)).toThrow("ERR_SCI_INVALID_REQUEST");
    expect(() => requireEmptySciQuery(query)).toThrow(
      "ERR_SCI_INVALID_REQUEST"
    );
  });

  it("keeps identical external IDs in separate synthetic company namespaces", async () => {
    const first = validateSciCatalog(
      unwrapSciMock(
        await requestMockSci({ operation: "catalog", companyId: 10 })
      ),
      10
    );
    const other = validateSciCatalog(
      unwrapSciMock(
        await requestMockSci({ operation: "catalog", companyId: 20 })
      ),
      20
    );
    expect(first.clients.map(client => client.externalClientId)).toEqual(
      other.clients.map(client => client.externalClientId)
    );
    expect(first.clients).toHaveLength(7);
    expect(first.clients[0].name).toBe(
      "Cliente SCI fictício 001 — escritório simulado 10"
    );
    expect(other.clients[0].name).toBe(
      "Cliente SCI fictício 001 — escritório simulado 20"
    );
    expect(
      first.clients.every(
        client =>
          client.documentLabel === "CNPJ fictício inválido: 00.000.000/0000-00"
      )
    ).toBe(true);
    expect(() => validateSciCatalog(other, 10)).toThrow(
      "ERR_SCI_INVALID_OUTPUT"
    );
  });

  it("paginates twelve synthetic publication metadata without duplicate or missing IDs", async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map(async page =>
        validateSciDetail(
          unwrapSciMock(
            await requestMockSci({
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
    expect(pages.map(result => result.publications.length)).toEqual([
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
      pages.flatMap(result => result.publications.map(item => item.id))
    ).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `mock-001-item-${String(index + 1).padStart(2, "0")}`
      )
    );
    expect(pages[0].publications[0]).toEqual({
      id: "mock-001-item-01",
      title: "Publicação fictícia 1 — escritório simulado 10",
      categoryLabel: "Categoria fictícia: relatório demonstrativo",
      periodLabel: "Competência fictícia 1",
      publishedAt: "2026-01-01T12:00:00.000Z"
    });
  });

  it("keeps empty and stale success states distinct", async () => {
    const empty = validateSciDetail(
      unwrapSciMock(
        await requestMockSci({
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
    expect(empty.publications).toEqual([]);
    expect(empty.pagination.total).toBe(0);
    expect(empty.source.stale).toBe(false);
    const stale = validateSciDetail(
      unwrapSciMock(
        await requestMockSci({
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
    expect(stale.publications).toHaveLength(2);
    expect(stale.source.stale).toBe(true);
    expect(Date.parse(stale.source.updatedAt)).toBeLessThan(
      Date.parse(stale.source.fetchedAt)
    );
  });

  it.each([
    [
      200,
      { Erro: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_SCI_FUNCTIONAL_ERROR",
      502
    ],
    [
      401,
      { detail: "FICTITIOUS_VENDOR_DETAIL" },
      "ERR_SCI_UPSTREAM_UNAUTHORIZED",
      502
    ],
    [429, { detail: "FICTITIOUS_VENDOR_DETAIL" }, "ERR_SCI_RATE_LIMITED", 429],
    [500, { detail: "FICTITIOUS_VENDOR_DETAIL" }, "ERR_SCI_UNAVAILABLE", 503]
  ])(
    "maps simulated transport status %s to a safe code",
    (status, payload, code, expectedStatus) => {
      let caught;
      try {
        unwrapSciMock({ status: status as number, payload });
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
    const good = validateSciDetail(
      unwrapSciMock(
        await requestMockSci({
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
    foreign.publications[0].id = "mock-002-item-01";
    cases.push(foreign);
    const duplicate = clone();
    duplicate.publications[1].id = duplicate.publications[0].id;
    cases.push(duplicate);
    cases.forEach(input =>
      expect(() => validateSciDetail(input, 10, "mock-001", 1)).toThrow(
        "ERR_SCI_INVALID_OUTPUT"
      )
    );
  });

  it.each(["url", "downloadUrl", "content", "read", "readAt", "status"])(
    "rejects document or read-state field %s instead of exposing it as publication metadata",
    async field => {
      const good = unwrapSciMock(
        await requestMockSci({
          operation: "detail",
          companyId: 10,
          externalClientId: "mock-001",
          page: 1
        })
      ) as { publications: Record<string, unknown>[] };
      good.publications[0][field] = "FICTITIOUS_DOCUMENT_CONTENT";
      expect(() => validateSciDetail(good, 10, "mock-001", 1)).toThrow(
        "ERR_SCI_INVALID_OUTPUT"
      );
    }
  );

  it("rejects wrong provider source, document fields on clients and invalid publication dates", async () => {
    const result = validateSciDetail(
      unwrapSciMock(
        await requestMockSci({
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
    const cases: unknown[] = [
      { ...result, source: { ...result.source, provider: "acessorias" } },
      {
        ...result,
        client: { ...result.client, documentUrl: "FICTITIOUS_DOCUMENT" }
      }
    ];
    ["2026-01-01", "invalid", "2099-01-01T00:00:00.000Z"].forEach(date => {
      const changed = JSON.parse(JSON.stringify(result));
      changed.publications[0].publishedAt = date;
      cases.push(changed);
    });
    cases.forEach(item => {
      expect(() => validateSciDetail(item, 10, "mock-001", 1)).toThrow(
        "ERR_SCI_INVALID_OUTPUT"
      );
    });
  });

  it("exercises the explicit invalid-output fixture without an external request", async () => {
    const result = unwrapSciMock(
      await requestMockSci({
        operation: "detail",
        companyId: 10,
        externalClientId: "mock-invalid-output",
        page: 1
      })
    );
    expect(() =>
      validateSciDetail(result, 10, "mock-invalid-output", 1)
    ).toThrow("ERR_SCI_INVALID_OUTPUT");
  });
});
