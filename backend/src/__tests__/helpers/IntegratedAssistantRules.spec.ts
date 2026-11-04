import AppError from "../../errors/AppError";
import {
  createIntegratedText,
  integratedAssistantMode,
  integratedContextVersion,
  integratedOperationalError,
  integratedWarnings,
  normalizeIntegratedClients,
  normalizeIntegratedDetail,
  parseIntegratedRequest,
  parseIntegratedReviewRequest,
  requireEmptyIntegratedQuery
} from "../../helpers/IntegratedAssistantRules";
import { buildAssistantContext } from "../../helpers/AssistantRules";
import { requestMockAcessorias } from "../../services/AcessoriasServices/MockAcessoriasProvider";
import { unwrapAcessoriasMock } from "../../helpers/AcessoriasRules";
import { requestMockSci } from "../../services/SciServices/MockSciProvider";
import { unwrapSciMock } from "../../helpers/SciRules";

const selection = { externalClientId: "mock-001", page: 1 };
const sources = { acessorias: selection, sci: null };
const context = buildAssistantContext([], {
  companyId: 10,
  ticketId: 301,
  contactId: 201,
  isGroup: false
});
const emptySources = () => ({
  acessorias: { state: "notSelected" as const, data: null, errorCode: null },
  sci: { state: "notSelected" as const, data: null, errorCode: null }
});
const detail = async (
  provider: "acessorias" | "sci",
  id = "mock-001",
  page = 1
): Promise<Record<string, unknown>> => {
  const raw =
    provider === "acessorias"
      ? unwrapAcessoriasMock(
          await requestMockAcessorias({
            operation: "detail",
            companyId: 10,
            externalClientId: id,
            page
          })
        )
      : unwrapSciMock(
          await requestMockSci({
            operation: "detail",
            companyId: 10,
            externalClientId: id,
            page
          })
        );
  const { companyId, ...data } = raw as Record<string, unknown>;
  expect(companyId).toBe(10);
  return { mode: "mock", simulated: true, ...data };
};

describe("integrated assistant bounded internal request and output rules", () => {
  it.each(["summary", "reply"])(
    "requires independent explicit source keys for %s",
    kind => {
      expect(parseIntegratedRequest({ kind, sources })).toEqual({
        kind,
        sources
      });
      expect(
        parseIntegratedRequest({
          kind,
          sources: {
            acessorias: { externalClientId: "mock-001", page: 100 },
            sci: { externalClientId: "mock-001", page: 2 }
          }
        }).sources.sci.page
      ).toBe(2);
    }
  );

  it.each([
    null,
    [],
    {},
    { kind: {} },
    { kind: "tool", sources },
    { kind: "reply", sources: { acessorias: null, sci: null } },
    { kind: "reply", sources: { acessorias: selection } },
    { kind: "reply", sources: { ...sources, other: selection } },
    { kind: "reply", sources, companyId: 20 },
    { kind: "reply", sources, contactId: 999 },
    { kind: "reply", sources, text: "untrusted request content" },
    {
      kind: "reply",
      sources: {
        acessorias: { ...selection, url: "https://example.invalid" },
        sci: null
      }
    },
    ...[0, -1, 101, 1.2, "1", null, true].map(page => ({
      kind: "reply",
      sources: { acessorias: { ...selection, page }, sci: null }
    })),
    ...["", "../other", "https://example.invalid", "MOCK-001", 1].map(
      externalClientId => ({
        kind: "reply",
        sources: { acessorias: { externalClientId, page: 1 }, sci: null }
      })
    )
  ])("rejects missing, extra and unsafe request fields: %p", input => {
    expect(() => parseIntegratedRequest(input)).toThrow(
      "ERR_INTEGRATED_ASSISTANT_INVALID_REQUEST"
    );
  });

  it("review accepts only a reply selection and opaque comparison version", () => {
    const input = { kind: "reply", sources, contextVersion: "a".repeat(64) };
    expect(parseIntegratedReviewRequest(input)).toEqual(input);
    expect(() =>
      parseIntegratedReviewRequest({ ...input, kind: "summary" })
    ).toThrow("INVALID_REQUEST");
    expect(() =>
      parseIntegratedReviewRequest({
        ...input,
        text: "edited text never goes to backend"
      })
    ).toThrow("INVALID_REQUEST");
    expect(() =>
      parseIntegratedReviewRequest({ ...input, contextVersion: "secret" })
    ).toThrow("INVALID_REQUEST");
    expect(() => requireEmptyIntegratedQuery({ companyId: 20 })).toThrow(
      "INVALID_REQUEST"
    );
  });

  it("versions change with office, actor, context, link generation and independent selection", () => {
    const original = {
      companyId: 10,
      actorId: "101",
      message: "fictitious",
      linkId: 1,
      sources
    };
    const version = integratedContextVersion(original);
    expect(version).toMatch(/^[a-f0-9]{64}$/);
    expect(version).not.toContain("fictitious");
    [
      { companyId: 20 },
      { actorId: "102" },
      { message: "changed" },
      { linkId: 2 },
      { sources: { acessorias: null, sci: selection } }
    ].forEach(changes => {
      expect(integratedContextVersion({ ...original, ...changes })).not.toBe(
        version
      );
    });
    expect(integratedContextVersion(original)).toBe(version);
  });

  it.each([undefined, "", "disabled", "real", "MOCK", "mock"])(
    "fails closed for mode %s",
    mode => {
      const before = process.env.INTEGRATED_ASSISTANT_MODE;
      try {
        if (mode === undefined) delete process.env.INTEGRATED_ASSISTANT_MODE;
        else process.env.INTEGRATED_ASSISTANT_MODE = mode;
        expect(integratedAssistantMode()).toBe(
          mode === "mock" ? "mock" : "disabled"
        );
      } finally {
        if (before === undefined) delete process.env.INTEGRATED_ASSISTANT_MODE;
        else process.env.INTEGRATED_ASSISTANT_MODE = before;
      }
    }
  );

  it.each(["acessorias", "sci"] as const)(
    "validates, bounds and detaches %s DTOs",
    async provider => {
      const raw = await detail(provider);
      const data = normalizeIntegratedDetail(provider, raw, 10, selection);
      expect(data.client.externalClientId).toBe("mock-001");
      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 5,
        total: 12,
        hasMore: true
      });
      expect("companyId" in data).toBe(false);
      (raw.client as { name: string }).name = "mutated after adapter response";
      expect(data.client.name).not.toBe("mutated after adapter response");
      expect(() =>
        normalizeIntegratedDetail(
          provider,
          { ...raw, downloadUrl: "https://example.invalid/private" },
          10,
          selection
        )
      ).toThrow("INVALID_OUTPUT");
      const catalogRaw =
        provider === "acessorias"
          ? unwrapAcessoriasMock(
              await requestMockAcessorias({
                operation: "catalog",
                companyId: 10
              })
            )
          : unwrapSciMock(
              await requestMockSci({ operation: "catalog", companyId: 10 })
            );
      const { companyId, ...catalog } = catalogRaw as Record<string, unknown>;
      expect(companyId).toBe(10);
      const clients = normalizeIntegratedClients(
        provider,
        { mode: "mock", simulated: true, ...catalog },
        10
      );
      expect(clients.state).toBe("ready");
      expect(clients.clients.length).toBeGreaterThan(0);
      expect(() =>
        normalizeIntegratedClients(
          provider,
          { mode: "mock", simulated: true, ...catalog, token: "fictitious" },
          10
        )
      ).toThrow("INVALID_OUTPUT");
    }
  );

  it("operational source failures are explicit while permission and context errors are fatal", () => {
    expect(
      integratedOperationalError("sci", new AppError("ERR_SCI_TIMEOUT", 504))
    ).toBe("ERR_SCI_TIMEOUT");
    expect(
      integratedOperationalError(
        "acessorias",
        new AppError("ERR_ACESSORIAS_RATE_LIMITED", 429)
      )
    ).toBe("ERR_ACESSORIAS_RATE_LIMITED");
    [
      new Error("private data"),
      new AppError("ERR_NO_PERMISSION", 403),
      new AppError("ERR_SCI_CLIENT_NOT_LINKED", 404),
      new AppError("ERR_SCI_CONTEXT_CHANGED", 409),
      new AppError("ERR_SCI_DISABLED", 403)
    ].forEach(error => {
      expect(integratedOperationalError("sci", error)).toBeUndefined();
    });
  });

  it("keeps source labels, bounded metadata, stale and incomplete-page warnings in simulated text", async () => {
    const data = normalizeIntegratedDetail(
      "sci",
      await detail("sci", "mock-stale"),
      10,
      { externalClientId: "mock-stale", page: 1 }
    );
    const results = {
      ...emptySources(),
      sci: { state: "ready" as const, data, errorCode: null }
    };
    const text = createIntegratedText("reply", [], results);
    expect(text).toContain("Simulação local SCI");
    expect(text).toContain("Dados desatualizados");
    expect(text).toContain(
      "não confirmam documentos, obrigações, prazos ou pagamentos"
    );
    expect(integratedWarnings("reply", context, results)).toEqual([
      "SIMULATED",
      "REVIEW_REQUIRED",
      "NO_MESSAGES",
      "INSUFFICIENT_INFORMATION",
      "STALE_SOURCES"
    ]);
    const failure = {
      ...emptySources(),
      sci: { state: "error" as const, data: null, errorCode: "ERR_SCI_TIMEOUT" }
    };
    expect(createIntegratedText("summary", [], failure)).toContain(
      "não foi possível obter os dados simulados"
    );
    expect(integratedWarnings("summary", context, failure)).toContain(
      "PARTIAL_SOURCES"
    );
    const page = normalizeIntegratedDetail(
      "acessorias",
      await detail("acessorias"),
      10,
      selection
    );
    expect(
      integratedWarnings(
        "summary",
        { ...context, partial: true },
        {
          ...emptySources(),
          acessorias: { state: "ready", data: page, errorCode: null }
        }
      )
    ).toEqual([
      "SIMULATED",
      "REVIEW_REQUIRED",
      "PARTIAL_CONTEXT",
      "NO_MESSAGES",
      "PARTIAL_PAGES"
    ]);
  });
});
