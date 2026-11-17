import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import authRoutes from "../../routes/authRoutes";
import * as SessionController from "../../controllers/SessionController";

// The route itself must refuse non-Super accounts before the controller runs,
// even if the service-level check regresses. The controller is a stub that
// would happily issue a session, so only the route guard stands in the way.
jest.mock("../../config/auth", () => ({
  __esModule: true,
  default: { secret: "fictional-route-guard-key" }
}));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../controllers/SessionController", () => ({
  store: jest.fn(),
  impersonate: jest.fn((_req, res) => res.status(200).json({ token: "x" })),
  backToSuper: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  me: jest.fn()
}));

const app = express();
app.use("/auth", authRoutes);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "UNEXPECTED_TEST_ERROR"
  })
);

const findByPk = User.findByPk as jest.Mock;
const impersonate = SessionController.impersonate as jest.Mock;
const rows: Record<number, { id: number; super: boolean }> = {
  101: { id: 101, super: false },
  102: { id: 102, super: false },
  103: { id: 103, super: true }
};
const bearer = (claims: Record<string, unknown>) =>
  `Bearer ${sign(claims, "fictional-route-guard-key", { expiresIn: 300 })}`;
const start = (authorization?: string) => {
  const pending = request(app).get("/auth/impersonate/20");
  if (authorization) pending.set("Authorization", authorization);
  return pending;
};

beforeEach(() => {
  jest.clearAllMocks();
  findByPk.mockImplementation(async id => rows[Number(id)] ?? null);
});

describe("GET /auth/impersonate/:companyId route guard", () => {
  it.each([
    ["a regular user", { id: 101, companyId: 10, profile: "user" }],
    ["a company administrator", { id: 102, companyId: 10, profile: "admin" }],
    [
      "an administrator forging a Super claim",
      { id: 102, companyId: 10, profile: "admin", super: true }
    ]
  ])("refuses %s before reaching the controller", async (_name, claims) => {
    const response = await start(bearer(claims));
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Acesso não permitido" });
    expect(findByPk).toHaveBeenCalledWith(claims.id);
    expect(impersonate).not.toHaveBeenCalled();
  });

  it("refuses a token whose account no longer exists", async () => {
    const response = await start(
      bearer({ id: 999, companyId: 10, profile: "admin", super: true })
    );
    expect(response.status).toBe(401);
    expect(impersonate).not.toHaveBeenCalled();
  });

  it("refuses requests without a bearer token", async () => {
    const response = await start();
    expect(response.status).toBe(401);
    expect(findByPk).not.toHaveBeenCalled();
    expect(impersonate).not.toHaveBeenCalled();
  });

  it("lets a current Super through to the controller", async () => {
    const response = await start(
      bearer({ id: 103, companyId: 10, profile: "admin", super: true })
    );
    expect(response.status).toBe(200);
    expect(impersonate).toHaveBeenCalledTimes(1);
  });

  it("keeps the return route open to the impersonated administrator", async () => {
    (SessionController.backToSuper as jest.Mock).mockImplementation(
      (_req, res) => res.status(200).json({})
    );
    const response = await request(app)
      .post("/auth/impersonate/back")
      .set(
        "Authorization",
        bearer({ id: 102, companyId: 20, profile: "admin", impersonated: true })
      );
    expect(response.status).toBe(200);
    expect(findByPk).not.toHaveBeenCalled();
  });
});
