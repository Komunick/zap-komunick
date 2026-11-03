import "express-async-errors";
import express from "express";
import request from "supertest";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import kanbanRoutes from "../../routes/kanbanRoutes";
import User from "../../models/User";
import Queue from "../../models/Queue";
import UserQueue from "../../models/UserQueue";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import sequelize from "../../database";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { websocketUpdateTicket } from "../../services/TicketServices/UpdateTicketService";

jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../models/Queue", () => ({ findAll: jest.fn() }));
jest.mock("../../models/UserQueue", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  findAll: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Company", () => ({}));
jest.mock("../../models/Whatsapp", () => ({}));
jest.mock("../../models/UserSocketSession", () => ({}));
jest.mock("../../models/Tag", () => ({ findAll: jest.fn() }));
jest.mock("../../models/TicketTag", () => ({
  findAll: jest.fn(),
  destroy: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../database", () => ({ transaction: jest.fn() }));
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/TicketServices/UpdateTicketService", () => ({
  websocketUpdateTicket: jest.fn()
}));
jest.mock("../../middleware/isAuth", () => (req, res, next) => {
  const actors = {
    "Bearer user-a": { id: "1", companyId: 10, profile: "user" },
    "Bearer admin-a": { id: "2", companyId: 10, profile: "admin" }
  };
  req.user = actors[req.headers.authorization];
  if (!req.user) return res.status(401).json({ error: "ERR_UNAUTHORIZED" });
  req.companyId = req.user.companyId;
  return next();
});
jest.mock(
  "../../middleware/isCompliant",
  () => (req, res, next) =>
    req.headers["x-expired-fictional-company"]
      ? res.status(402).json({ error: "ERR_SUBSCRIPTION_EXPIRED" })
      : next()
);

type Link = { ticketId: number; tagId: number };
interface Row {
  [key: string]: unknown;
  id?: number;
  companyId?: number;
  profile?: string;
  userId?: number;
  contactId?: number;
  queueId?: number | null;
  queueIds?: number[] | null;
  status?: string;
  ticketId?: number;
  tagId?: number;
  kanban?: number;
  name?: string;
  queues?: Row[];
  tags?: Row[];
  contact?: { id: number; name: string; number: string };
  reload?: jest.Mock;
}
type Where = Record<PropertyKey, unknown>;
interface FakeTransaction {
  LOCK: { SHARE: string; UPDATE: string };
  links: Link[];
}
interface QueryOptions {
  where?: Where;
  attributes?: string[];
  transaction?: FakeTransaction;
  lock?: string;
  include?: Association[];
}
interface Association {
  as?: string;
  where?: Where;
  required?: boolean;
  attributes?: string[];
}
let users: Row[],
  queues: Row[],
  memberships: Row[],
  tickets: Row[],
  tags: Row[],
  contacts: Row[];
let links: Link[], activeTransaction: FakeTransaction | undefined;
let createFails: boolean, hydrateFails: boolean, commitFails: boolean;
let membershipRemovedAtQueueLock: boolean;
const operations: { model: string; options: QueryOptions }[] = [];

// Model doubles honor the Sequelize predicates rather than manufacturing a
// denial. The actual router, controller and service must supply the fence.
function matches(row: Row, where: Where = {}): boolean {
  return Reflect.ownKeys(where).every(key => {
    const value = where[key];
    if (key === Op.and)
      return (value as Where[]).every(item => matches(row, item));
    if (key === Op.or)
      return (value as Where[]).some(item => matches(row, item));
    const actual = row[key as string];
    if (value && typeof value === "object") {
      const condition = value as Record<symbol, unknown[]>;
      if (Op.in in value) return condition[Op.in].includes(actual);
      if (Op.or in value) return condition[Op.or].includes(actual);
      throw new Error("Unsupported fictional predicate");
    }
    return String(actual) === String(value);
  });
}

const query = (model: string, rows: Row[], options: QueryOptions = {}) => {
  operations.push({ model, options });
  return rows
    .filter(row => matches(row, options.where))
    .map(row =>
      options.attributes
        ? Object.fromEntries(
            options.attributes.map(attribute => [attribute, row[attribute]])
          )
        : row
    );
};
const currentLinks = (options: QueryOptions = {}): Link[] =>
  options.transaction?.links || links;
const tagIds = (ticketId: number) =>
  links
    .filter(link => link.ticketId === ticketId)
    .map(link => link.tagId)
    .sort();

function hydrate(row: Row, transaction?: FakeTransaction): Row {
  const record = {
    ...row,
    contact: {
      id: row.id,
      name: `CLIENT-PRIVATE-${row.id}`,
      number: "5500000000000"
    },
    tags: tags.filter(
      tag =>
        tag.companyId === row.companyId &&
        currentLinks({ transaction }).some(
          link => link.ticketId === row.id && link.tagId === tag.id
        )
    )
  } as Row;
  record.reload = jest.fn(async () => {
    Object.assign(record, hydrate(row, transaction));
    return record;
  });
  return record;
}

// Honor association predicates/required joins as well as the primary where.
// A tenant fence on Ticket alone must not hide an unsafe eager association.
function hydrateIncluded(row: Row, options: QueryOptions): Row | null {
  const record = hydrate(row, options.transaction);
  const associations = options.include || [];
  for (let index = 0; index < associations.length; index++) {
    const association = associations[index];
    const pools: Record<string, Row[]> = {
      contact: contacts.filter(contact => contact.id === row.contactId),
      queue: queues.filter(queue => queue.id === row.queueId),
      user: users.filter(user => user.id === row.userId),
      tags: tags.filter(tag =>
        currentLinks(options).some(
          link => link.ticketId === row.id && link.tagId === tag.id
        )
      )
    };
    if (!(association.as in pools)) continue;
    const related = pools[association.as].filter(item =>
      matches(item, association.where)
    );
    if (association.required && !related.length) return null;
    const projected = related.map(item =>
      association.attributes
        ? Object.fromEntries(
            association.attributes.map(attribute => [
              attribute,
              item[attribute]
            ])
          )
        : item
    );
    record[association.as] =
      association.as === "tags" ? projected : projected[0] || null;
  }
  return record;
}

const app = express();
app.use(express.json());
app.use(kanbanRoutes);
app.use((error, _req, res, _next) => {
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "ERR_FICTITIOUS_FAILURE"
  });
});
const move = (ticketId: number | string, tagId: unknown, actor = "user-a") =>
  request(app)
    .put(`/kanban/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${actor}`)
    .send({ tagId });

beforeEach(() => {
  jest.clearAllMocks();
  operations.length = 0;
  activeTransaction = undefined;
  createFails = false;
  hydrateFails = false;
  commitFails = false;
  membershipRemovedAtQueueLock = false;
  users = [
    { id: 1, companyId: 10, profile: "user" },
    { id: 2, companyId: 10, profile: "admin" },
    { id: 3, companyId: 10, profile: "user" },
    { id: 4, companyId: 20, profile: "user" }
  ];
  queues = [
    { id: 101, companyId: 10 },
    { id: 102, companyId: 10 },
    { id: 201, companyId: 20 }
  ];
  memberships = [
    { userId: 1, queueId: 101 },
    { userId: 3, queueId: 102 },
    { userId: 4, queueId: 201 }
  ];
  tickets = [
    { id: 301, companyId: 10, queueId: 101, status: "pending", userId: null },
    { id: 302, companyId: 10, queueId: 102, status: "pending", userId: 3 },
    { id: 303, companyId: 10, queueId: 101, status: "open", userId: 1 },
    { id: 304, companyId: 10, queueId: 101, status: "open", userId: 3 },
    { id: 305, companyId: 20, queueId: 201, status: "pending", userId: 4 },
    { id: 306, companyId: 10, queueId: 101, status: "paused", userId: 1 },
    { id: 307, companyId: 10, queueId: 101, status: "closed", userId: 1 },
    { id: 308, companyId: 10, queueId: null, status: "pending", userId: 1 },
    { id: 309, companyId: 10, queueId: 102, status: "open", userId: 1 }
  ];
  tags = [
    { id: 11, companyId: 10, kanban: 1, name: "Coluna inicial" },
    { id: 12, companyId: 10, kanban: 1, name: "Outra coluna" },
    { id: 13, companyId: 10, kanban: 0, name: "Preservar" },
    { id: 21, companyId: 20, kanban: 1, name: "Outra empresa" }
  ];
  tickets = tickets.map(ticket => ({ ...ticket, contactId: ticket.id }));
  links = tickets.flatMap(ticket =>
    ticket.companyId === 10
      ? [
          { ticketId: ticket.id, tagId: 11 },
          { ticketId: ticket.id, tagId: 13 }
        ]
      : [{ ticketId: ticket.id, tagId: 21 }]
  );
  contacts = tickets.map(ticket => ({
    id: ticket.id,
    companyId: ticket.companyId,
    name: `CLIENT-PRIVATE-${ticket.id}`,
    number: "5500000000000"
  }));
  (User.findOne as jest.Mock).mockImplementation(
    async options => query("user", users, options)[0] || null
  );
  (Contact.findOne as jest.Mock).mockImplementation(
    async options => query("contact-auth", contacts, options)[0] || null
  );
  (User.findByPk as jest.Mock).mockImplementation(async id => {
    const user = users.find(item => String(item.id) === String(id));
    return user
      ? {
          ...user,
          queues: queues.filter(queue =>
            memberships.some(
              m => m.userId === user.id && m.queueId === queue.id
            )
          )
        }
      : null;
  });
  (UserQueue.findAll as jest.Mock).mockImplementation(async options =>
    query("membership", memberships, options)
  );
  (Queue.findAll as jest.Mock).mockImplementation(async options => {
    const result = query("queue", queues, options);
    if (options.lock && membershipRemovedAtQueueLock)
      memberships = memberships.filter(m => m.userId !== 1);
    return result;
  });
  (Ticket.findOne as jest.Mock).mockImplementation(async options => {
    const row = query("ticket", tickets, options)[0];
    return row ? (options.include ? hydrateIncluded(row, options) : row) : null;
  });
  (Ticket.findAll as jest.Mock).mockImplementation(async options =>
    query("ticket-list", tickets, options)
      .map(row => hydrateIncluded(row, options))
      .filter(Boolean)
  );
  (Tag.findAll as jest.Mock).mockImplementation(async options =>
    query("tag", tags, options)
  );
  (TicketTag.findAll as jest.Mock).mockImplementation(async options =>
    query("ticket-tags", currentLinks(options), options)
  );
  (TicketTag.destroy as jest.Mock).mockImplementation(async options => {
    const rows = currentLinks(options);
    const kept = rows.filter(row => !matches(row, options.where));
    rows.splice(0, rows.length, ...kept);
  });
  (TicketTag.create as jest.Mock).mockImplementation(async (row, options) => {
    if (createFails) throw new Error("Fictitious insert failure");
    currentLinks(options).push({ ...row });
    return row;
  });
  (ShowTicketService as jest.Mock).mockImplementation(
    async (id, companyId, transaction) => {
      if (hydrateFails) throw new Error("Fictitious hydration failure");
      const row = tickets.find(
        ticket =>
          String(ticket.id) === String(id) && ticket.companyId === companyId
      );
      if (!row) throw new AppError("ERR_NO_TICKET_FOUND", 404);
      return hydrate(row, transaction);
    }
  );
  (sequelize.transaction as jest.Mock).mockImplementation(async callback => {
    const transaction = {
      LOCK: { SHARE: "SHARE", UPDATE: "UPDATE" },
      links: links.map(link => ({ ...link }))
    };
    activeTransaction = transaction;
    try {
      const result = await callback(transaction);
      if (commitFails) throw new Error("Fictitious commit failure");
      links = transaction.links;
      return result;
    } finally {
      activeTransaction = undefined;
    }
  });
  (websocketUpdateTicket as jest.Mock).mockImplementation(async () => {
    expect(activeTransaction).toBeUndefined();
  });
});

function expectNoEffects(before: Link[]) {
  expect(links).toEqual(before);
  expect(TicketTag.destroy).not.toHaveBeenCalled();
  expect(TicketTag.create).not.toHaveBeenCalled();
  expect(websocketUpdateTicket).not.toHaveBeenCalled();
}

it.each([0, 12])(
  "refuses another queue's pending ticket before hydration, writes or events (lane %s)",
  async tagId => {
    const before = links.map(link => ({ ...link }));
    const response = await move(302, tagId);
    expect(response.status).toBe(404);
    expect(response.text).not.toContain("CLIENT-PRIVATE-302");
    expect(ShowTicketService).not.toHaveBeenCalled();
    expect(Tag.findAll).not.toHaveBeenCalled();
    expectNoEffects(before);
  }
);

it.each([304, 305, 307, 308, 309])(
  "movement preserves listing eligibility for ticket %s",
  async id => {
    const before = links.map(link => ({ ...link }));
    const response = await move(id, 12);
    expect(response.status).toBe(404);
    expect(ShowTicketService).not.toHaveBeenCalled();
    expectNoEffects(before);
  }
);

it("does not move a closed ticket even for an administrator", async () => {
  const before = links.map(link => ({ ...link }));
  expect((await move(307, 12, "admin-a")).status).toBe(404);
  expectNoEffects(before);
});

it.each([305, 999, null])(
  "refuses a foreign, missing or absent contact %s before tag IO",
  async contactId => {
    tickets.find(ticket => ticket.id === 301).contactId = contactId;
    const before = links.map(link => ({ ...link }));
    const response = await move(301, 12);
    expect(response.status).toBe(404);
    expect(response.text).not.toContain("CLIENT-PRIVATE-305");
    expect(Tag.findAll).not.toHaveBeenCalled();
    expect(TicketTag.findAll).not.toHaveBeenCalled();
    expect(ShowTicketService).not.toHaveBeenCalled();
    expectNoEffects(before);
  }
);

it.each(["list", "move"])(
  "rejects a previous-company session before loading ticket data (%s)",
  async operation => {
    users[0].companyId = 20;
    memberships[0].queueId = 201;
    const before = links.map(link => ({ ...link }));
    const response =
      operation === "list"
        ? await request(app)
            .get("/kanban")
            .set("Authorization", "Bearer user-a")
        : await move(305, 0);
    expect(response.status).toBe(403);
    expect(Ticket.findOne).not.toHaveBeenCalled();
    expect(Ticket.findAll).not.toHaveBeenCalled();
    expect(ShowTicketService).not.toHaveBeenCalled();
    expect(Tag.findAll).not.toHaveBeenCalled();
    expectNoEffects(before);
  }
);

it("rejects a removed actor before ticket metadata", async () => {
  users = users.filter(user => user.id !== 1);
  const response = await move(301, 12);
  expect(response.status).toBe(403);
  expect(Ticket.findOne).not.toHaveBeenCalled();
  expect(ShowTicketService).not.toHaveBeenCalled();
  expect(websocketUpdateTicket).not.toHaveBeenCalled();
});

it("uses the current profile instead of the token's administrative claim", async () => {
  users[1].profile = "user";
  memberships.push({ userId: 2, queueId: 101 });
  const response = await move(304, 12, "admin-a");
  expect([403, 404]).toContain(response.status);
  expect(TicketTag.destroy).not.toHaveBeenCalled();
  expect(TicketTag.create).not.toHaveBeenCalled();
});

it.each([
  [301, 12, "user-a"],
  [303, 0, "user-a"],
  [306, 12, "user-a"],
  [302, 12, "admin-a"],
  [308, 12, "admin-a"]
])(
  "preserves permitted ticket %s lane %s actor %s",
  async (id, lane, actor) => {
    const response = await move(id, lane, actor as string);
    expect(response.status).toBe(200);
    expect(tagIds(Number(id))).toEqual(lane === 0 ? [13] : [12, 13]);
    expect(response.body.contact.name).toBe(`CLIENT-PRIVATE-${id}`);
    expect(response.body.tags.map(tag => tag.id).sort()).toEqual(
      tagIds(Number(id))
    );
    expect(websocketUpdateTicket).toHaveBeenCalledTimes(1);
  }
);

it("keeps an idempotent permitted move without rewriting tags", async () => {
  expect((await move(301, 11)).status).toBe(200);
  expect(tagIds(301)).toEqual([11, 13]);
  expect(TicketTag.destroy).not.toHaveBeenCalled();
  expect(TicketTag.create).not.toHaveBeenCalled();
});

it.each(["user-a", "admin-a"])(
  "lists only eligible states, ownership, queues and company for %s",
  async actor => {
    const response = await request(app)
      .get("/kanban")
      .set("Authorization", `Bearer ${actor}`);
    expect(response.status).toBe(200);
    const ids = response.body.lanes
      .flatMap(lane => lane.tickets.map(ticket => ticket.id))
      .sort();
    expect(ids).toEqual(
      actor === "user-a" ? [301, 303, 306] : [301, 302, 303, 304, 306, 308, 309]
    );
  }
);

it("does not authorize a legacy foreign queue membership", async () => {
  memberships.push({ userId: 1, queueId: 201 });
  tickets.push({
    id: 310,
    companyId: 10,
    queueId: 201,
    status: "pending",
    userId: null
  });
  const response = await move(310, 0);
  expect(response.status).toBe(404);
  expect(ShowTicketService).not.toHaveBeenCalled();
});

it("rechecks membership after locking parent queues", async () => {
  membershipRemovedAtQueueLock = true;
  const before = links.map(link => ({ ...link }));
  expect((await move(301, 0)).status).toBe(404);
  expect(ShowTicketService).not.toHaveBeenCalled();
  expectNoEffects(before);
});

it("rolls back removal if the replacement insert fails", async () => {
  createFails = true;
  const before = links.map(link => ({ ...link }));
  expect((await move(301, 12)).status).toBe(500);
  expect(TicketTag.destroy).toHaveBeenCalledTimes(1);
  expect(links).toEqual(before);
  expect(websocketUpdateTicket).not.toHaveBeenCalled();
});

it.each(["hydrate", "commit"])(
  "rolls back and emits no event on %s failure",
  async phase => {
    hydrateFails = phase === "hydrate";
    commitFails = phase === "commit";
    const before = links.map(link => ({ ...link }));
    expect((await move(301, 12)).status).toBe(500);
    expect(links).toEqual(before);
    expect(websocketUpdateTicket).not.toHaveBeenCalled();
  }
);

it("locks simple authorization rows in parent-before-membership order and writes one transaction", async () => {
  expect((await move(301, 12)).status).toBe(200);
  const locked = operations.filter(operation => operation.options.lock);
  const queue = locked.findIndex(operation => operation.model === "queue");
  const membership = locked.findIndex(
    operation => operation.model === "membership"
  );
  const ticket = locked.find(operation => operation.model === "ticket");
  expect(queue).toBeGreaterThanOrEqual(0);
  expect(membership).toBeGreaterThan(queue);
  expect(ticket).toBeDefined();
  expect(ticket.options.include).toBeUndefined();
  const tx = ticket.options.transaction;
  expect((TicketTag.destroy as jest.Mock).mock.calls[0][0].transaction).toBe(
    tx
  );
  expect((TicketTag.create as jest.Mock).mock.calls[0][1].transaction).toBe(tx);
  expect((ShowTicketService as jest.Mock).mock.calls[0][2]).toBe(tx);
  const contact = operations.find(
    operation => operation.model === "contact-auth"
  );
  expect(contact.options.transaction).toBe(tx);
  expect(contact.options.lock).toBeUndefined();
});

it.each(["0", "-1", "1.5", "not-an-id"])(
  "rejects invalid ticket input %s",
  async id => {
    expect((await move(id, 0)).status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(ShowTicketService).not.toHaveBeenCalled();
  }
);

it("rejects a foreign-company lane without writes or events", async () => {
  const before = links.map(link => ({ ...link }));
  expect((await move(301, 21)).status).toBe(404);
  expectNoEffects(before);
});

it.each(["user-a", "admin-a"])(
  "refuses an incompatible sector destination even for %s",
  async actor => {
    tags[1].queueIds = [102];
    const before = links.map(link => ({ ...link }));
    expect((await move(301, 12, actor)).status).toBe(404);
    expect(TicketTag.findAll).not.toHaveBeenCalled();
    expectNoEffects(before);
  }
);

it.each([{ queueIds: null }, { queueIds: [101] }])(
  "accepts a general or matching sector destination $queueIds",
  async ({ queueIds }) => {
    tags[1].queueIds = queueIds;
    expect((await move(301, 12)).status).toBe(200);
    expect(tagIds(301)).toEqual([12, 13]);
  }
);

it.each([0, 12])(
  "explicitly removes historical Kanban tags from a former sector when moving to %s",
  async lane => {
    tags[0].queueIds = [102];
    expect((await move(301, lane)).status).toBe(200);
    expect(tagIds(301)).toEqual(lane === 0 ? [13] : [12, 13]);
  }
);

it.each(["user-a", "admin-a"])(
  "filters board columns by current tag visibility for %s",
  async actor => {
    tags[0].queueIds = [101];
    tags[1].queueIds = [102];
    tags.push({
      id: 14,
      companyId: 10,
      kanban: 1,
      name: "Geral",
      queueIds: null
    });
    const response = await request(app)
      .get("/kanban")
      .set("Authorization", `Bearer ${actor}`);
    expect(response.status).toBe(200);
    expect(response.body.lanes.map(lane => lane.tag?.id ?? 0).sort()).toEqual(
      actor === "user-a" ? [0, 11, 14] : [0, 11, 12, 14]
    );
  }
);

it("keeps an eligible ticket with a hidden historical tag in the open lane", async () => {
  tags[0].queueIds = [102];
  const response = await request(app)
    .get("/kanban")
    .set("Authorization", "Bearer user-a");
  expect(response.status).toBe(200);
  expect(response.body.lanes.some(lane => lane.tag?.id === 11)).toBe(false);
  const open = response.body.lanes.find(lane => lane.tag === null);
  expect(open.tickets.map(ticket => ticket.id).sort()).toEqual([301, 303, 306]);
});

it("preserves authentication and compliance gates", async () => {
  expect(
    (await request(app).put("/kanban/tickets/301").send({ tagId: 0 })).status
  ).toBe(401);
  expect(
    (
      await request(app)
        .get("/kanban")
        .set("Authorization", "Bearer user-a")
        .set("x-expired-fictional-company", "1")
    ).status
  ).toBe(402);
  expect(User.findOne).not.toHaveBeenCalled();
});

it.each(["contact", "queue", "user", "tag"])(
  "does not return foreign %s metadata through a legacy association",
  async association => {
    contacts.find(contact => contact.id === 305).name = "FOREIGN-CONTACT";
    queues.find(queue => queue.id === 201).name = "FOREIGN-QUEUE";
    users.find(user => user.id === 4).name = "FOREIGN-USER";
    tags.find(tag => tag.id === 21).name = "FOREIGN-TAG";
    const ticket = tickets.find(row => row.id === 301);
    if (association === "contact") ticket.contactId = 305;
    if (association === "queue") ticket.queueId = 201;
    if (association === "user") ticket.userId = 4;
    if (association === "tag") links.push({ ticketId: 301, tagId: 21 });
    const response = await request(app)
      .get("/kanban")
      .set("Authorization", "Bearer admin-a");
    expect(response.status).toBe(200);
    expect(response.text).not.toContain("FOREIGN-");
    const listed = response.body.lanes
      .flatMap(lane => lane.tickets)
      .find(row => row.id === 301);
    if (association === "contact") expect(listed).toBeUndefined();
    else expect(listed).toBeDefined();
  }
);

it("preserves legitimate associated data in the board DTO", async () => {
  users[0].name = "Pessoa ficticia";
  queues[0].name = "Fila ficticia";
  const response = await request(app)
    .get("/kanban")
    .set("Authorization", "Bearer user-a");
  expect(response.status).toBe(200);
  const ticket = response.body.lanes
    .flatMap(lane => lane.tickets)
    .find(row => row.id === 303);
  expect(ticket.contact.name).toBe("CLIENT-PRIVATE-303");
  expect(ticket.queue.name).toBe("Fila ficticia");
  expect(ticket.user.name).toBe("Pessoa ficticia");
  expect(ticket.tags.map(tag => tag.id).sort()).toEqual([11, 13]);
});

it.each([10, undefined])(
  "real ShowTicketService preserves conditional user isolation for company %s",
  async companyId => {
    const show = jest.requireActual<
      typeof import("../../services/TicketServices/ShowTicketService")
    >("../../services/TicketServices/ShowTicketService").default;
    tickets.find(row => row.id === 301).userId = 4;
    const ticket = await show(301, companyId);
    expect(ticket.user?.id ?? null).toBe(companyId === 10 ? null : 4);
  }
);

it("real ShowTicketService preserves legitimate users and the optional transaction", async () => {
  const show = jest.requireActual<
    typeof import("../../services/TicketServices/ShowTicketService")
  >("../../services/TicketServices/ShowTicketService").default;
  const tx = {
    LOCK: { SHARE: "SHARE", UPDATE: "UPDATE" },
    links: links.map(link => ({ ...link }))
  };
  // Keep this invocation valid against the old two-argument function as well;
  // its failure must be the missing forwarded transaction, not TS compilation.
  const invoke = show as unknown as (...args: unknown[]) => Promise<Ticket>;
  const ticket = await invoke(303, 10, tx);
  expect(ticket.user.id).toBe(1);
  expect((Ticket.findOne as jest.Mock).mock.calls[0][0].transaction).toBe(tx);
});
