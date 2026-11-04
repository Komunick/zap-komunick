import { Request, Response } from "express";
import { generate } from "../../controllers/AssistantController";
import { generateTicketAssistant } from "../../services/AssistantServices/TicketAssistantService";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";

jest.mock("../../services/AssistantServices/TicketAssistantService", () => ({
  generateTicketAssistant: jest.fn()
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn()
}));

it("audits only execution metadata and derives the actor from the session", async () => {
  const result = {
    ticketId: 301,
    contactId: 201,
    kind: "summary",
    mode: "mock",
    simulated: true,
    requiresReview: true,
    text: "FICTITIOUS_OUTPUT_CONTENT_CANARY",
    references: [
      {
        messageId: "FICTITIOUS_REFERENCE_CANARY",
        excerpt: "FICTITIOUS_QUOTE_CANARY"
      }
    ],
    context: { messageCount: 2, characterCount: 150, partial: true }
  };
  (generateTicketAssistant as jest.Mock).mockResolvedValue(result);
  const req = {
    user: { id: "101", companyId: 10 },
    params: { ticketId: "301" },
    body: { kind: "summary" }
  } as unknown as Request;
  const res = { json: jest.fn() };
  await generate(req, res as unknown as Response);
  expect(generateTicketAssistant).toHaveBeenCalledWith(
    "301",
    { userId: "101", companyId: 10 },
    { kind: "summary" }
  );
  expect(auditRequest).toHaveBeenCalledWith(
    req,
    "assistant.generated",
    "ticket",
    301,
    {
      kind: "summary",
      mode: "mock",
      simulated: true,
      messageCount: 2,
      characterCount: 150,
      partial: true
    }
  );
  const details = (auditRequest as jest.Mock).mock.calls[0].slice(1);
  expect(JSON.stringify(details)).not.toMatch(
    /CONTENT_CANARY|REFERENCE_CANARY|QUOTE_CANARY/
  );
  expect(res.json).toHaveBeenCalledWith(result);
});
