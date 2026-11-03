import { Request, Response } from "express";
import {
  clients,
  generate,
  review,
  status
} from "../../controllers/IntegratedAssistantController";
import {
  generateTicketIntegratedAssistant,
  reviewTicketIntegratedAssistant,
  ticketIntegratedAssistantClients,
  ticketIntegratedAssistantStatus
} from "../../services/IntegratedAssistantServices/TicketIntegratedAssistantService";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";

jest.mock(
  "../../services/IntegratedAssistantServices/TicketIntegratedAssistantService",
  () => ({
    generateTicketIntegratedAssistant: jest.fn(),
    reviewTicketIntegratedAssistant: jest.fn(),
    ticketIntegratedAssistantClients: jest.fn(),
    ticketIntegratedAssistantStatus: jest.fn()
  })
);
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn()
}));
const req = () =>
  ({
    user: { id: "101", companyId: 10 },
    params: { ticketId: "301" },
    body: {
      kind: "reply",
      sources: {
        acessorias: null,
        sci: { externalClientId: "mock-001", page: 1 }
      }
    },
    query: {}
  }) as unknown as Request;
beforeEach(() => jest.clearAllMocks());

it("derives the actor from the session and audits only execution metadata without an awaited authorization gap", async () => {
  const result = {
    ticketId: 301,
    contactId: 201,
    kind: "reply",
    mode: "mock",
    simulated: true,
    text: "FICTITIOUS_TEXT_CANARY",
    references: [
      { messageId: "FICTITIOUS_REFERENCE", excerpt: "FICTITIOUS_QUOTE" }
    ],
    contextVersion: "FICTITIOUS_VERSION",
    context: { messageCount: 2, partial: true },
    sources: {
      acessorias: { state: "notSelected", data: null },
      sci: { state: "ready", data: { client: { name: "FICTITIOUS_CLIENT" } } }
    }
  };
  (generateTicketIntegratedAssistant as jest.Mock).mockResolvedValue(result);
  (auditRequest as jest.Mock).mockImplementation(
    () => new Promise(() => undefined)
  );
  const request = req();
  const res = { json: jest.fn() };
  await generate(request, res as unknown as Response);
  expect(generateTicketIntegratedAssistant).toHaveBeenCalledWith(
    "301",
    { userId: "101", companyId: 10 },
    request.body,
    {}
  );
  expect(auditRequest).toHaveBeenCalledWith(
    request,
    "integrated_assistant.generated",
    "ticket",
    301,
    {
      kind: "reply",
      mode: "mock",
      simulated: true,
      messageCount: 2,
      partial: true,
      sourceCount: 1,
      failedSourceCount: 0
    }
  );
  expect(
    JSON.stringify((auditRequest as jest.Mock).mock.calls[0].slice(1))
  ).not.toMatch(/TEXT_CANARY|REFERENCE|QUOTE|VERSION|CLIENT/);
  expect(res.json).toHaveBeenCalledWith(result);
});

it("forwards read queries and current identity, never caller-selected office data", async () => {
  const request = req();
  const res = { json: jest.fn() };
  (ticketIntegratedAssistantStatus as jest.Mock).mockResolvedValue({
    enabled: true
  });
  (ticketIntegratedAssistantClients as jest.Mock).mockResolvedValue({
    mode: "mock"
  });
  await status(request, res as unknown as Response);
  await clients(request, res as unknown as Response);
  expect(ticketIntegratedAssistantStatus).toHaveBeenCalledWith(
    "301",
    { userId: "101", companyId: 10 },
    {}
  );
  expect(ticketIntegratedAssistantClients).toHaveBeenCalledWith(
    "301",
    { userId: "101", companyId: 10 },
    {}
  );
});

it("review only records its action and does not audit the version or edited text", async () => {
  const request = req();
  request.body.contextVersion = "VERSION_CANARY";
  const result = { valid: true, mode: "mock", simulated: true };
  const res = { json: jest.fn() };
  (reviewTicketIntegratedAssistant as jest.Mock).mockResolvedValue(result);
  await review(request, res as unknown as Response);
  expect(reviewTicketIntegratedAssistant).toHaveBeenCalledWith(
    "301",
    { userId: "101", companyId: 10 },
    request.body,
    {}
  );
  expect(auditRequest).toHaveBeenCalledWith(
    request,
    "integrated_assistant.reviewed",
    "ticket",
    "301",
    { kind: "reply", mode: "mock", simulated: true }
  );
  expect(
    JSON.stringify((auditRequest as jest.Mock).mock.calls[0].slice(1))
  ).not.toContain("VERSION_CANARY");
  expect(res.json).toHaveBeenCalledWith(result);
});
