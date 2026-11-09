import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import { sign } from "jsonwebtoken";
import request from "supertest";
import * as UserController from "../../controllers/UserController";
import User from "../../models/User";
import userRoutes from "../../routes/userRoutes";

jest.mock("../../config/auth", () => ({ secret: "queue-scope-test-secret" }));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../controllers/UserController", () => {
  const respond = (_req: Request, res: Response) => res.sendStatus(200);
  return {
    index: jest.fn(respond),
    list: jest.fn(respond),
    online: jest.fn(respond),
    store: jest.fn(respond),
    update: jest.fn(respond),
    show: jest.fn(respond),
    remove: jest.fn(respond)
  };
});

const app = express();
app.use(userRoutes);
app.use((error, _req: Request, res: Response, _next: NextFunction) =>
  res.sendStatus(error.statusCode ?? 500)
);

const bearer = sign(
  { id: 11, companyId: 21, profile: "admin", super: false },
  "queue-scope-test-secret"
);

describe("administrator access is checked against the current account", () => {
  it("rejects an old admin token for account creation after a team demotion", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      profile: "user",
      companyId: 21
    });

    await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(403);
    expect(UserController.store).not.toHaveBeenCalled();
  });

  it("rejects an old admin token for account deletion", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      profile: "user",
      companyId: 21
    });

    await request(app)
      .delete("/users/12")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(403);
    expect(UserController.remove).not.toHaveBeenCalled();
  });

  it("still allows an active company administrator to create an account", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      profile: "admin",
      companyId: 21
    });

    await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    expect(UserController.store).toHaveBeenCalledTimes(1);
  });

  it("rejects an admin bearer issued before the account changed companies", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      profile: "admin",
      companyId: 22
    });

    await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(403);
    expect(UserController.store).not.toHaveBeenCalled();
  });
});
