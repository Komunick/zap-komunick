import {
  createAcessoriasLink,
  deleteAcessoriasLink,
  ticketAcessoriasCatalog,
  ticketAcessoriasClients,
  ticketAcessoriasDetail,
  ticketAcessoriasStatus
} from "../../services/AcessoriasServices/TicketAcessoriasService";
import { requestMockAcessorias } from "../../services/AcessoriasServices/MockAcessoriasProvider";
import sequelize from "../../database";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import ContactExternalClientLink from "../../models/ContactExternalClientLink";
import AppError from "../../errors/AppError";

jest.mock("../../database", () => ({ transaction: jest.fn() }));
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Contact", () => ({
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({
  findAll: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/ContactExternalClientLink", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
  destroy: jest.fn()
}));
jest.mock("../../services/AcessoriasServices/MockAcessoriasProvider");

const actualProvider = jest.requireActual<
  typeof import("../../services/AcessoriasServices/MockAcessoriasProvider")
>(
  "../../services/AcessoriasServices/MockAcessoriasProvider"
).requestMockAcessorias;
const actor = { userId: "101", companyId: 10 };
const transaction = { LOCK: { UPDATE: "UPDATE" } };
const initialTicket = {
  id: 301,
  companyId: 10,
  contactId: 201,
  queueId: 401,
  isGroup: false
};
const row = (externalClientId = "mock-001", overrides = {}) => ({
  id: 501,
  companyId: 10,
  contactId: 201,
  provider: "acessorias",
  externalClientId,
  updatedAt: "2026-10-27T12:00:00.000Z",
  ...overrides
});
let links: ReturnType<typeof row>[];
let flags: { value: string }[];
let ticket: typeof initialTicket;
const originalMode = process.env.ACESSORIAS_MODE;
const viewer = (profile = "user", queues = [{ id: 401, companyId: 10 }]) =>
  (User.findOne as jest.Mock).mockResolvedValue({
    id: 101,
    companyId: 10,
    profile,
    queues
  });
const matches = (
  link: ReturnType<typeof row>,
  where: Record<string, unknown>
) =>
  Object.entries(where).every(
    ([key, value]) => link[key as keyof typeof link] === value
  );
const detail = (externalId = "mock-001", query = {}) =>
  ticketAcessoriasDetail("301", actor, externalId, query);
const admin = () => viewer("admin", []);

describe("Acessórias local mapping and authorized mock reads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACESSORIAS_MODE = "mock";
    links = [row()];
    flags = [{ value: "enabled" }];
    ticket = { ...initialTicket };
    viewer();
    (Ticket.findOne as jest.Mock).mockImplementation(async () => ({
      ...ticket
    }));
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 201,
      companyId: 10
    });
    (Setting.findAll as jest.Mock).mockImplementation(async () => flags);
    (ContactExternalClientLink.findOne as jest.Mock).mockImplementation(
      async options => links.find(link => matches(link, options.where)) || null
    );
    (ContactExternalClientLink.findAll as jest.Mock).mockImplementation(
      async options => links.filter(link => matches(link, options.where))
    );
    (ContactExternalClientLink.findOrCreate as jest.Mock).mockImplementation(
      async options => {
        const existing = links.find(link => matches(link, options.where));
        if (existing) return [existing, false];
        const added = row(options.where.externalClientId, {
          ...options.where,
          id: 502 + links.length
        });
        links.push(added);
        return [added, true];
      }
    );
    (ContactExternalClientLink.destroy as jest.Mock).mockImplementation(
      async options => {
        const count = links.filter(link => matches(link, options.where)).length;
        links = links.filter(link => !matches(link, options.where));
        return count;
      }
    );
    (sequelize.transaction as jest.Mock).mockImplementation(async operation => {
      const before = [...links];
      try {
        return await operation(transaction);
      } catch (error) {
        links = before;
        throw error;
      }
    });
    (requestMockAcessorias as jest.Mock).mockImplementation(actualProvider);
  });
  afterAll(() => {
    if (originalMode === undefined) delete process.env.ACESSORIAS_MODE;
    else process.env.ACESSORIAS_MODE = originalMode;
  });

  it.each([undefined, "", "disabled", "real", "acessorias", "MOCK"])(
    "fails closed for backend mode %s",
    async mode => {
      if (mode === undefined) delete process.env.ACESSORIAS_MODE;
      else process.env.ACESSORIAS_MODE = mode;
      await expect(
        ticketAcessoriasStatus("301", actor, {})
      ).resolves.toMatchObject({
        enabled: false,
        mode: "disabled",
        simulated: true,
        reason: "SERVER_DISABLED",
        canManageLinks: false,
        limits: { pageSize: 5, maxPage: 100 }
      });
      await expect(detail()).rejects.toMatchObject({
        message: "ERR_ACESSORIAS_DISABLED",
        statusCode: 403
      });
      expect(requestMockAcessorias).not.toHaveBeenCalled();
    }
  );

  it.each(
    [
      [],
      [{ value: "disabled" }],
      [{ value: "unexpected" }],
      [{ value: "enabled" }, { value: "disabled" }]
    ].map(value => [value])
  )("requires enabled and unambiguous own-company settings", async value => {
    flags = value;
    await expect(detail()).rejects.toMatchObject({
      message: "ERR_ACESSORIAS_DISABLED"
    });
    expect(Setting.findAll).toHaveBeenCalledWith({
      where: { companyId: 10, key: "acessoriasEnabled" },
      attributes: ["value"],
      logging: false
    });
    expect(requestMockAcessorias).not.toHaveBeenCalled();
  });

  it.each(
    [[], [{ id: 402, companyId: 10 }], [{ id: 401, companyId: 20 }]].map(
      queues => [queues]
    )
  )(
    "enforces current staff sector access before any adapter call",
    async queues => {
      viewer("user", queues);
      await expect(detail()).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        ticketAcessoriasClients("301", actor, {})
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(requestMockAcessorias).not.toHaveBeenCalled();
    }
  );

  it("rejects another company or inconsistent contact and actor without reading the adapter", async () => {
    ticket.companyId = 20;
    await expect(detail()).rejects.toMatchObject({ statusCode: 404 });
    ticket = { ...initialTicket };
    (Contact.findOne as jest.Mock).mockResolvedValue(null);
    await expect(detail()).rejects.toMatchObject({ statusCode: 404 });
    (User.findOne as jest.Mock).mockResolvedValue({
      companyId: 20,
      profile: "admin",
      queues: []
    });
    await expect(detail()).rejects.toMatchObject({ statusCode: 403 });
    expect(requestMockAcessorias).not.toHaveBeenCalled();
  });

  it("allows staff to query only explicit links and never grants catalog or link administration", async () => {
    await expect(detail()).resolves.toMatchObject({
      mode: "mock",
      simulated: true,
      client: { externalClientId: "mock-001" },
      pagination: { page: 1, pageSize: 5, total: 12, hasMore: true }
    });
    await expect(
      ticketAcessoriasCatalog("301", actor, {})
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_MANAGE_DENIED" });
    await expect(
      createAcessoriasLink("301", actor, { externalClientId: "mock-002" }, {})
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_MANAGE_DENIED" });
    await expect(
      deleteAcessoriasLink("301", actor, "mock-001", {})
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_MANAGE_DENIED" });
    expect(ContactExternalClientLink.findOrCreate).not.toHaveBeenCalled();
    expect(ContactExternalClientLink.destroy).not.toHaveBeenCalled();
  });

  it.each([{ companyId: 20 }, { contactId: 202 }, { provider: "sci" }])(
    "does not use an equal external ID owned by another context",
    async overrides => {
      links = [row("mock-001", overrides)];
      await expect(detail()).rejects.toMatchObject({
        message: "ERR_ACESSORIAS_CLIENT_NOT_LINKED",
        statusCode: 404
      });
      expect(requestMockAcessorias).not.toHaveBeenCalled();
      expect(ContactExternalClientLink.findOne).toHaveBeenCalledWith({
        where: {
          companyId: 10,
          contactId: 201,
          provider: "acessorias",
          externalClientId: "mock-001"
        },
        logging: false
      });
    }
  );

  it("keeps absence of a mapping explicit instead of inferring a client", async () => {
    links = [];
    const listed = await ticketAcessoriasClients("301", actor, {});
    expect(listed.clients).toEqual([]);
    (requestMockAcessorias as jest.Mock).mockClear();
    await expect(detail()).rejects.toMatchObject({
      message: "ERR_ACESSORIAS_CLIENT_NOT_LINKED"
    });
    expect(requestMockAcessorias).not.toHaveBeenCalled();
  });

  it("creates multiple local bindings, does not duplicate repeated creates, and preserves other contexts", async () => {
    admin();
    links = [
      row("mock-001", { companyId: 20 }),
      row("mock-001", { contactId: 202 })
    ];
    const first = await createAcessoriasLink(
      "301",
      actor,
      { externalClientId: "mock-001" },
      {}
    );
    const duplicate = await createAcessoriasLink(
      "301",
      actor,
      { externalClientId: "mock-001" },
      {}
    );
    const second = await createAcessoriasLink(
      "301",
      actor,
      { externalClientId: "mock-002" },
      {}
    );
    expect(first).toMatchObject({
      created: true,
      linked: true,
      contactId: 201
    });
    expect(duplicate.created).toBe(false);
    expect(second.created).toBe(true);
    expect(links).toHaveLength(4);
    expect(ContactExternalClientLink.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 10,
          contactId: 201,
          provider: "acessorias",
          externalClientId: "mock-001"
        },
        transaction,
        logging: false
      })
    );
    expect(Contact.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 201, companyId: 10 },
        transaction,
        lock: "UPDATE"
      })
    );
    viewer();
    const list = await ticketAcessoriasClients("301", actor, {});
    expect(list.clients.map(client => client.externalClientId)).toEqual([
      "mock-001",
      "mock-002"
    ]);
    expect((await detail("mock-002")).pendingItems).toEqual([]);
  });

  it("removes only the local selected mapping and remains idempotent with the feature disabled", async () => {
    admin();
    links = [
      row(),
      row("mock-001", { companyId: 20 }),
      row("mock-001", { contactId: 202 }),
      row("mock-002", { id: 502 })
    ];
    process.env.ACESSORIAS_MODE = "disabled";
    flags = [{ value: "disabled" }];
    expect(
      await deleteAcessoriasLink("301", actor, "mock-001", {})
    ).toMatchObject({ linked: false, deleted: true });
    expect(
      await deleteAcessoriasLink("301", actor, "mock-001", {})
    ).toMatchObject({ linked: false, deleted: false });
    expect(links).toHaveLength(3);
    expect(links.some(link => link.companyId === 20)).toBe(true);
    expect(links.some(link => link.contactId === 202)).toBe(true);
    expect(links.some(link => link.externalClientId === "mock-002")).toBe(true);
    expect(requestMockAcessorias).not.toHaveBeenCalled();
  });

  it("rejects unknown catalog IDs and client-supplied authority before changing mappings", async () => {
    admin();
    await expect(
      createAcessoriasLink(
        "301",
        actor,
        { externalClientId: "mock-unknown" },
        {}
      )
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_CLIENT_NOT_FOUND" });
    await expect(
      createAcessoriasLink(
        "301",
        actor,
        { externalClientId: "mock-001", companyId: 20 },
        {}
      )
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_INVALID_REQUEST" });
    await expect(
      detail("mock-001", { page: "1", contactId: "202" })
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_INVALID_REQUEST" });
    expect(ContactExternalClientLink.findOrCreate).not.toHaveBeenCalled();
  });

  it.each(["removed", "recreated", "updated"])(
    "refuses a mapping %s during an asynchronous read",
    async change => {
      (requestMockAcessorias as jest.Mock).mockImplementation(async request => {
        const result = await actualProvider(request);
        if (change === "removed") links = [];
        if (change === "recreated") links = [row("mock-001", { id: 999 })];
        if (change === "updated")
          links = [row("mock-001", { updatedAt: "2026-10-27T13:00:00.000Z" })];
        return result;
      });
      await expect(detail()).rejects.toMatchObject({
        message: "ERR_ACESSORIAS_CONTEXT_CHANGED",
        statusCode: 409
      });
    }
  );

  it("refuses a linked-client list changed during a mock read", async () => {
    (requestMockAcessorias as jest.Mock).mockImplementation(async request => {
      const result = await actualProvider(request);
      links = [];
      return result;
    });
    await expect(
      ticketAcessoriasClients("301", actor, {})
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_CONTEXT_CHANGED" });
  });

  it.each(["sector", "transfer", "contact", "flag", "mode"])(
    "rechecks %s after the asynchronous mock",
    async change => {
      (requestMockAcessorias as jest.Mock).mockImplementation(async request => {
        const result = await actualProvider(request);
        if (change === "sector") viewer("user", []);
        if (change === "transfer") {
          admin();
          ticket.queueId = 402;
        }
        if (change === "contact") ticket.contactId = 202;
        if (change === "flag") flags = [{ value: "disabled" }];
        if (change === "mode") process.env.ACESSORIAS_MODE = "disabled";
        return result;
      });
      await expect(detail()).rejects.toMatchObject({
        statusCode:
          change === "contact" ? 404 : change === "transfer" ? 409 : 403
      });
    }
  );

  it("rolls back a local create when the administrator loses access before commit", async () => {
    admin();
    links = [];
    (ContactExternalClientLink.findOrCreate as jest.Mock).mockImplementation(
      async options => {
        links.push(row(options.where.externalClientId));
        viewer("user");
        return [links[0], true];
      }
    );
    await expect(
      createAcessoriasLink("301", actor, { externalClientId: "mock-001" }, {})
    ).rejects.toMatchObject({ message: "ERR_ACESSORIAS_MANAGE_DENIED" });
    expect(links).toEqual([]);
  });

  it.each([
    ["mock-error200", "ERR_ACESSORIAS_FUNCTIONAL_ERROR", 502],
    ["mock-unauthorized", "ERR_ACESSORIAS_UPSTREAM_UNAUTHORIZED", 502],
    ["mock-rate-limit", "ERR_ACESSORIAS_RATE_LIMITED", 429]
  ])(
    "handles the explicit failure scenario %s without returning stale client data",
    async (externalClientId, message, statusCode) => {
      links = [row(String(externalClientId))];
      await expect(detail(String(externalClientId))).rejects.toMatchObject({
        message,
        statusCode
      });
    }
  );

  it("bounds a simulated timeout without network or cached fallback data", async () => {
    jest.useFakeTimers();
    try {
      links = [row("mock-timeout")];
      const result = expect(detail("mock-timeout")).rejects.toMatchObject({
        message: "ERR_ACESSORIAS_TIMEOUT",
        statusCode: 504
      });
      for (let n = 0; n < 30; n += 1) await Promise.resolve();
      jest.advanceTimersByTime(2001);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects another company's payload and masks raw adapter/ORM failures", async () => {
    (requestMockAcessorias as jest.Mock).mockImplementation(request =>
      actualProvider({ ...request, companyId: 20 })
    );
    await expect(detail()).rejects.toMatchObject({
      message: "ERR_ACESSORIAS_INVALID_OUTPUT",
      statusCode: 502
    });
    (requestMockAcessorias as jest.Mock).mockRejectedValue(
      new AppError("FICTITIOUS_RAW_CLIENT_DATA", 400)
    );
    const failure = await detail().catch(error => error);
    expect(failure).toMatchObject({
      message: "ERR_ACESSORIAS_UNAVAILABLE",
      statusCode: 503
    });
    expect(JSON.stringify(failure)).not.toContain("FICTITIOUS_RAW_CLIENT_DATA");
    (Setting.findAll as jest.Mock).mockRejectedValue({
      message: "FICTITIOUS_SQL_DATA",
      parameters: ["FICTITIOUS_SQL_DATA"]
    });
    expect(JSON.stringify(await detail().catch(error => error))).not.toContain(
      "FICTITIOUS_SQL_DATA"
    );
  });

  it("performs no local business writes during reads and reads only the flag setting", async () => {
    await ticketAcessoriasClients("301", actor, {});
    await detail();
    expect(Ticket.update).not.toHaveBeenCalled();
    expect(Contact.update).not.toHaveBeenCalled();
    expect(Setting.update).not.toHaveBeenCalled();
    expect(ContactExternalClientLink.findOrCreate).not.toHaveBeenCalled();
    expect(ContactExternalClientLink.destroy).not.toHaveBeenCalled();
    expect(
      (Setting.findAll as jest.Mock).mock.calls.every(
        ([options]) => options.where.key === "acessoriasEnabled"
      )
    ).toBe(true);
    expect(
      (requestMockAcessorias as jest.Mock).mock.calls.every(
        ([request]) =>
          request.companyId === 10 &&
          ["catalog", "detail"].includes(request.operation)
      )
    ).toBe(true);
  });

  it.each(["create", "delete"])(
    "uses the same transaction for every authorization query during %s",
    async operation => {
      admin();
      let inside = false;
      const checked: string[] = [];
      (sequelize.transaction as jest.Mock).mockImplementation(async execute => {
        inside = true;
        try {
          return await execute(transaction);
        } finally {
          inside = false;
        }
      });
      const guard = (name: string, options: { transaction?: unknown }) => {
        if (!inside) return;
        if (options.transaction !== transaction)
          throw new Error(
            "Authorization attempted to acquire another connection"
          );
        checked.push(name);
      };
      (User.findOne as jest.Mock).mockImplementation(async options => {
        guard("User/queues", options);
        return { id: 101, companyId: 10, profile: "admin", queues: [] };
      });
      (Ticket.findOne as jest.Mock).mockImplementation(async options => {
        guard("Ticket", options);
        return { ...ticket };
      });
      (Contact.findOne as jest.Mock).mockImplementation(async options => {
        guard("Contact", options);
        return { id: 201, companyId: 10 };
      });
      (Setting.findAll as jest.Mock).mockImplementation(async options => {
        guard("Setting", options);
        return flags;
      });
      if (operation === "create") {
        await expect(
          createAcessoriasLink(
            "301",
            actor,
            { externalClientId: "mock-002" },
            {}
          )
        ).resolves.toMatchObject({ created: true });
        expect(checked).toContain("Setting");
      } else {
        await expect(
          deleteAcessoriasLink("301", actor, "mock-001", {})
        ).resolves.toMatchObject({ deleted: true });
      }
      expect(checked).toEqual(
        expect.arrayContaining(["User/queues", "Ticket", "Contact"])
      );
    }
  );
});
