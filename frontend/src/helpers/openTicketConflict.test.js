import {
  describeOpenTicketConflict,
  openTicketFromError
} from "./openTicketConflict";
import { i18n } from "../translate/i18n";

const openTicket = {
  id: 55,
  uuid: "abc",
  status: "open",
  updatedAt: "2026-11-20T13:00:00.000Z",
  user: { id: 7, name: "Raiane" },
  queue: { id: 3, name: "Pessoal" },
  whatsapp: { id: 7, name: "JBFraga", connected: false },
  canView: true,
  canTake: false
};

describe("openTicketConflict", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt");
  });

  it("reads the open ticket from the API error", () => {
    const err = {
      response: {
        data: { error: "ERR_OTHER_OPEN_TICKET", details: { openTicket } }
      }
    };
    expect(openTicketFromError(err)).toEqual(openTicket);
    expect(
      openTicketFromError({ response: { data: { error: "ERR_OTHER" } } })
    ).toBeNull();
    expect(openTicketFromError(new Error("x"))).toBeNull();
  });

  it("says who has it, the queue and the disconnected channel", () => {
    const text = describeOpenTicketConflict(openTicket);
    expect(text).toContain("#55");
    expect(text).toContain("com Raiane");
    expect(text).toContain("na fila Pessoal");
    expect(text).toContain("JBFraga (desconectado)");
  });

  it("describes a pending ticket without an agent", () => {
    const text = describeOpenTicketConflict({
      ...openTicket,
      status: "pending",
      user: null
    });
    expect(text).toContain("aguardando na fila");
  });

  it("says the ticket is paused", () => {
    const text = describeOpenTicketConflict({
      ...openTicket,
      status: "paused"
    });
    expect(text).toContain("com Raiane");
    expect(text).toContain("pausado");
  });

  it("does not escape names and dates twice", () => {
    const text = describeOpenTicketConflict({
      ...openTicket,
      user: { id: 7, name: "Ana & Cia" },
      queue: { id: 3, name: "D'Ávila" }
    });
    expect(text).toContain("Ana & Cia");
    expect(text).toContain("D'Ávila");
    expect(text).toMatch(/\d{2}\/\d{2}\/2026/);
    expect(text).not.toContain("&amp;");
    expect(text).not.toContain("&#x2F;");
  });

  it("falls back to the plain message without details", () => {
    expect(describeOpenTicketConflict(null)).toBe(
      i18n.t("backendErrors.ERR_OTHER_OPEN_TICKET")
    );
  });
});
