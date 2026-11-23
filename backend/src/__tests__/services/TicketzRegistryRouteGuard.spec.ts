import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import ticketzOSSRoutes from "../../routes/ticketzOSSRoutes";
import * as TicketzOSSController from "../../controllers/TicketzOSSController";

// The installation registry belongs to the whole system: it reads and rewrites
// company 1 settings and posts the installation data to the Ticketz registry.
// Only a Super account may reach it; a company administrator must not.
jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: "fictional-registry-guard-key" }
}));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../controllers/TicketzOSSController", () => ({
  show: jest.fn((_req, res) => res.status(200).json({})),
  store: jest.fn((_req, res) => res.status(200).json({}))
}));

const app = express();
app.use(express.json());
app.use(ticketzOSSRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

const findByPk = User.findByPk as jest.Mock;
const show = TicketzOSSController.show as jest.Mock;
const store = TicketzOSSController.store as jest.Mock;
const rows: Record<number, Record<string, unknown>> = {
  201: { id: 201, companyId: 2, profile: "admin", super: false },
  202: { id: 202, companyId: 1, profile: "admin", super: false },
  203: { id: 203, companyId: 1, profile: "admin", super: true }
};
const bearer = (claims: Record<string, unknown>) =>
  `Bearer ${sign(claims, "fictional-registry-guard-key", { expiresIn: 300 })}`;

beforeEach(() => {
  jest.clearAllMocks();
  findByPk.mockImplementation(async id => rows[Number(id)] ?? null);
});

describe("Ticketz registry routes", () => {
  it.each([
    ["a tenant administrator", { id: 201, companyId: 2, profile: "admin" }],
    [
      "an administrator of the main company",
      { id: 202, companyId: 1, profile: "admin" }
    ],
    [
      "an administrator forging a Super claim",
      { id: 201, companyId: 2, profile: "admin", super: true }
    ]
  ])("refuses %s on read and write", async (_name, claims) => {
    const read = await request(app)
      .get("/ticketz/registry")
      .set("Authorization", bearer(claims));
    const write = await request(app)
      .post("/ticketz/registry")
      .set("Authorization", bearer(claims))
      .send({ name: "ficticio" });

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
    expect(show).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it("lets a current Super read and update the registry", async () => {
    const auth = bearer({
      id: 203,
      companyId: 1,
      profile: "admin",
      super: true
    });
    expect(
      (await request(app).get("/ticketz/registry").set("Authorization", auth))
        .status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/ticketz/registry")
          .set("Authorization", auth)
          .send({ name: "ficticio" })
      ).status
    ).toBe(200);
    expect(show).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledTimes(1);
  });
});
