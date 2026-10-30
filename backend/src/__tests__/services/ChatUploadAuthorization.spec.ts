import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import AppError from "../../errors/AppError";
import routes from "../../routes/chatRoutes";
const AuthorizeChatService = jest.requireMock(
  "../../services/ChatService/AuthorizeChatService"
).default as jest.Mock;
import * as ChatController from "../../controllers/ChatController";

const mockStorageAdmission = jest.fn();
jest.mock("multer", () => {
  const multer = jest.fn(() => ({
    array: () => (_req: Request, _res: Response, next: NextFunction) => {
      mockStorageAdmission();
      next();
    }
  }));
  return Object.assign(multer, { diskStorage: () => ({}) });
});
jest.mock("../../middleware/isAuth", () => ({
  __esModule: true,
  default: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "101", companyId: 10, profile: "admin", isSuper: true };
    next();
  }
}));
jest.mock(
  "../../services/ChatService/AuthorizeChatService",
  () => ({ __esModule: true, default: jest.fn() }),
  { virtual: true }
);
jest.mock("../../controllers/ChatController", () =>
  Object.fromEntries(
    [
      "index",
      "show",
      "messages",
      "store",
      "direct",
      "update",
      "remove",
      "checkAsRead",
      "saveMessage"
    ].map(name => [
      name,
      jest.fn((_req: Request, res: Response) => res.json({ ok: true }))
    ])
  )
);

function app() {
  const server = express();
  server.use(routes);
  server.use(
    (error: AppError, _req: Request, res: Response, _next: NextFunction) =>
      res.status(error.statusCode || 500).json({ error: error.message })
  );
  return server;
}

beforeEach(() => jest.clearAllMocks());

it("rejects a denied chat before admitting bytes to storage or controller", async () => {
  (AuthorizeChatService as jest.Mock).mockRejectedValue(
    new AppError("ERR_NO_CHAT_FOUND", 404)
  );
  const response = await request(app())
    .post("/chats/301/messages")
    .attach("medias", Buffer.from("Fictional attachment"), "fixture.txt");
  expect(response.status).toBe(404);
  expect(mockStorageAdmission).not.toHaveBeenCalled();
  expect(ChatController.saveMessage).not.toHaveBeenCalled();
});

it("allows a participant into storage only after checking the authenticated context", async () => {
  (AuthorizeChatService as jest.Mock).mockResolvedValue({ id: 301 });
  const response = await request(app())
    .post("/chats/301/messages")
    .attach("medias", Buffer.from("Fictional attachment"), "fixture.txt");
  expect(response.status).toBe(200);
  expect(AuthorizeChatService).toHaveBeenCalledWith("301", {
    userId: "101",
    companyId: 10
  });
  expect(mockStorageAdmission).toHaveBeenCalledTimes(1);
  expect(ChatController.saveMessage).toHaveBeenCalledTimes(1);
});
