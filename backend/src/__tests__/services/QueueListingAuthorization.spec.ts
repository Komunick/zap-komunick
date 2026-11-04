import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import queueRoutes from "../../routes/queueRoutes";
import Queue from "../../models/Queue";
import User from "../../models/User";

// Keep the route, JWT middleware, controller and listing service real. Only
// unrelated I/O and model access are doubled, with actual company predicates.
jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: "fictional-queue-route-key-not-a-real-secret" }
}));
jest.mock("../../models/Queue", () => ({ findAll: jest.fn() }));
jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../services/QueueService/CreateQueueService", () => jest.fn());
jest.mock("../../services/QueueService/DeleteQueueService", () => jest.fn());
jest.mock("../../services/QueueService/ShowQueueService", () => jest.fn());
jest.mock("../../services/QueueService/UpdateQueueService", () => jest.fn());
jest.mock("../../helpers/saveMediaFile", () => jest.fn());

interface Actor {
  id: number;
  companyId: number;
  profile: string;
  super: boolean;
}
interface QueueRow {
  id: number;
  companyId: number;
  name: string;
  color: string;
}
interface Predicate {
  where: Record<string, unknown>;
  attributes?: string[];
}

const app = express();
app.use(express.json());
app.use(queueRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

const actorFixtures: Record<string, Actor> = {
  userA: { id: 101, companyId: 10, profile: "user", super: false },
  adminA: { id: 102, companyId: 10, profile: "admin", super: false },
  superA: { id: 103, companyId: 10, profile: "admin", super: true },
  userB: { id: 201, companyId: 20, profile: "user", super: false },
  adminB: { id: 202, companyId: 20, profile: "admin", super: false },
  superB: { id: 203, companyId: 20, profile: "admin", super: true }
};
const queueFixtures: QueueRow[] = [
  { id: 401, companyId: 10, name: "QA Alfa Atendimento", color: "#336699" },
  { id: 402, companyId: 10, name: "QA Alfa Fiscal", color: "#996633" },
  { id: 501, companyId: 20, name: "QA Beta Privada", color: "#669933" }
];
let users: Actor[];
let queues: QueueRow[];

const bearer = (
  actor: string,
  overrides: Record<string, unknown> = {},
  secret = "fictional-queue-route-key-not-a-real-secret"
) =>
  sign(
    {
      ...actorFixtures[actor],
      id: String(actorFixtures[actor].id),
      ...overrides
    },
    secret,
    { expiresIn: "5m" }
  );
const get = (actor: string, query = "", overrides = {}) =>
  request(app)
    .get(`/queue${query}`)
    .set("Authorization", `Bearer ${bearer(actor, overrides)}`);
const ownRows = (companyId: number) =>
  queueFixtures
    .filter(queue => queue.companyId === companyId)
    .sort((left, right) => left.name.localeCompare(right.name));

beforeEach(() => {
  jest.clearAllMocks();
  users = Object.values(actorFixtures).map(actor => ({ ...actor }));
  queues = queueFixtures.map(queue => ({ ...queue }));
  (User.findOne as jest.Mock).mockImplementation(
    async ({ where, attributes }: Predicate) => {
      const row = users.find(actor =>
        Object.entries(where).every(
          ([key, value]) => actor[key as keyof Actor] === value
        )
      );
      if (!row) return null;
      return attributes
        ? Object.fromEntries(
            attributes.map(attribute => [
              attribute,
              row[attribute as keyof Actor]
            ])
          )
        : { ...row };
    }
  );
  (Queue.findAll as jest.Mock).mockImplementation(
    async ({ where }: Predicate) =>
      queues
        .filter(queue =>
          Object.entries(where).every(
            ([key, value]) => queue[key as keyof QueueRow] === value
          )
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(queue => ({ ...queue }))
  );
});

describe.each(Object.keys(actorFixtures))("GET /queue as %s", actor => {
  it("lists only the actor's own company by default", async () => {
    const response = await get(actor);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(ownRows(actorFixtures[actor].companyId));
  });

  it("preserves an explicit own-company filter", async () => {
    const companyId = actorFixtures[actor].companyId;
    const response = await get(actor, `?companyId=${companyId}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(ownRows(companyId));
  });
});

it.each(["userA", "adminA"])(
  "does not let %s replace the authenticated company through body or headers",
  async actor => {
    const response = await request(app)
      .get("/queue")
      .set("Authorization", `Bearer ${bearer(actor)}`)
      .set("companyId", "20")
      .set("X-Company-Id", "20")
      .send({ companyId: 20, user: { companyId: 20, isSuper: true } });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(ownRows(10));
    expect(Queue.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 10 } })
    );
  }
);

it.each(["userA", "adminA", "userB", "adminB"])(
  "refuses %s crossing companies before accessing queue data",
  async actor => {
    const companyId = actorFixtures[actor].companyId === 10 ? 20 : 10;
    const response = await get(actor, `?companyId=${companyId}`);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
    expect(Queue.findAll).not.toHaveBeenCalled();
  }
);

it.each(["superA", "superB"])(
  "preserves %s listing a selected foreign company",
  async actor => {
    const companyId = actorFixtures[actor].companyId === 10 ? 20 : 10;
    const response = await get(actor, `?companyId=${companyId}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(ownRows(companyId));
    expect(Queue.findAll).toHaveBeenCalledTimes(1);
  }
);

it("returns an empty list for an authorized company with no queues", async () => {
  queues = queues.filter(queue => queue.companyId !== 20);
  const response = await get("superA", "?companyId=20");
  expect(response.status).toBe(200);
  expect(response.body).toEqual([]);
});

const malformed = [
  "companyId[]=20",
  "companyId[tenant]=20",
  "companyId=10&companyId=20",
  "companyId=10&companyId=10",
  "companyId=NaN",
  "companyId=0",
  "companyId=-20",
  "companyId=20.5",
  "companyId=20.0",
  "companyId=020",
  "companyId=2e1",
  "companyId=0x14",
  "companyId=Infinity",
  "companyId=9007199254740992",
  "companyId=",
  "companyId=%2020",
  "companyId=20%20",
  "companyId=%2B20"
];

describe.each(["userA", "adminA", "superA"])(
  "GET /queue malformed parser input as %s",
  actor => {
    it.each(malformed)("rejects %s before queue access", async query => {
      const response = await get(actor, `?${query}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "ERR_BAD_REQUEST" });
      expect(Queue.findAll).not.toHaveBeenCalled();
    });
  }
);

it("uses the current database privilege after a super flag is revoked", async () => {
  users.find(actor => actor.id === actorFixtures.superA.id).super = false;
  const response = await get("superA", "?companyId=20");
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("refuses a forged super claim for an ordinary administrator", async () => {
  const response = await get("adminA", "?companyId=20", { super: true });
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("requires a fresh token after the current profile changes", async () => {
  users.find(actor => actor.id === actorFixtures.adminA.id).profile = "user";
  const response = await get("adminA");
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("refuses an actor transferred after the token was issued", async () => {
  users.find(actor => actor.id === actorFixtures.userA.id).companyId = 20;
  const response = await get("userA");
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("refuses an actor deleted after the token was issued", async () => {
  users = users.filter(actor => actor.id !== actorFixtures.userA.id);
  const response = await get("userA");
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("does not accept a company claim unrelated to the current account", async () => {
  const response = await get("userA", "", { companyId: 20 });
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_NO_PERMISSION" });
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("requires authentication before any queue listing", async () => {
  const response = await request(app).get("/queue?companyId=20");
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: "ERR_UNAUTHORIZED" });
  expect(User.findOne).not.toHaveBeenCalled();
  expect(Queue.findAll).not.toHaveBeenCalled();
});

it("refuses a JWT signed by a different issuer before queue access", async () => {
  const response = await request(app)
    .get("/queue?companyId=20")
    .set(
      "Authorization",
      `Bearer ${bearer("superA", {}, "fictional-wrong-key")}`
    );
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ error: "ERR_SESSION_EXPIRED" });
  expect(User.findOne).not.toHaveBeenCalled();
  expect(Queue.findAll).not.toHaveBeenCalled();
});
