import { Request, Response } from "express";
import { create, remove } from "../../controllers/AcessoriasController";
import {
  createAcessoriasLink,
  deleteAcessoriasLink
} from "../../services/AcessoriasServices/TicketAcessoriasService";
import { auditRequest } from "../../services/AuditServices/RecordAuditService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

jest.mock("../../services/AcessoriasServices/TicketAcessoriasService", () => ({
  createAcessoriasLink: jest.fn(),
  deleteAcessoriasLink: jest.fn()
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn()
}));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

const request = {
  params: { ticketId: "301", externalClientId: "mock-001" },
  query: {},
  body: { externalClientId: "mock-001" },
  user: { id: "101", companyId: 10 }
} as unknown as Request;
const emit = jest.fn();
const to = jest.fn(() => ({ emit }));
beforeEach(() => {
  jest.clearAllMocks();
  (getIO as jest.Mock).mockReturnValue({ to });
});

it.each([true, false])(
  "emits only contact metadata and audits effective local creation: %s",
  async created => {
    (createAcessoriasLink as jest.Mock).mockResolvedValue({
      externalClientId: "mock-001",
      linked: true,
      created,
      contactId: 201
    });
    const res = { json: jest.fn() };
    await create(request, res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({
      externalClientId: "mock-001",
      linked: true,
      created
    });
    if (created) {
      expect(auditRequest).toHaveBeenCalledWith(
        request,
        "acessorias.link_created",
        "contact",
        201,
        { provider: "acessorias", externalClientId: "mock-001" }
      );
      expect(to).toHaveBeenCalledWith("company-10-mainchannel");
      expect(emit).toHaveBeenCalledWith("company-10-acessorias-links", {
        contactId: 201
      });
    } else {
      expect(auditRequest).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    }
  }
);

it.each([true, false])(
  "emits and audits only effective local removals: %s",
  async deleted => {
    (deleteAcessoriasLink as jest.Mock).mockResolvedValue({
      externalClientId: "mock-001",
      linked: false,
      deleted,
      contactId: 201
    });
    const res = { json: jest.fn() };
    await remove(request, res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({
      externalClientId: "mock-001",
      linked: false,
      deleted
    });
    expect(auditRequest).toHaveBeenCalledTimes(deleted ? 1 : 0);
    expect(emit).toHaveBeenCalledTimes(deleted ? 1 : 0);
  }
);

it("preserves a committed result if socket transport fails without logging the raw error", async () => {
  (createAcessoriasLink as jest.Mock).mockResolvedValue({
    externalClientId: "mock-001",
    linked: true,
    created: true,
    contactId: 201
  });
  (getIO as jest.Mock).mockImplementation(() => {
    throw new Error("FICTITIOUS_RAW_TRANSPORT_DATA");
  });
  const res = { json: jest.fn() };
  await create(request, res as unknown as Response);
  expect(res.json).toHaveBeenCalledWith({
    externalClientId: "mock-001",
    linked: true,
    created: true
  });
  expect(auditRequest).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    { companyId: 10, contactId: 201 },
    "Acessórias local link notification unavailable"
  );
  expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
    "FICTITIOUS_RAW_TRANSPORT_DATA"
  );
});
