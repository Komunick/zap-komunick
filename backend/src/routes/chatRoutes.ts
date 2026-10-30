import express from "express";
import isAuth from "../middleware/isAuth";
import authorizeChatUpload, {
  receiveChatUpload
} from "../middleware/authorizeChatUpload";
import * as ChatController from "../controllers/ChatController";

const routes = express.Router();

routes.get("/chats", isAuth, ChatController.index);

routes.get("/chats/:id", isAuth, ChatController.show);

routes.get("/chats/:id/messages", isAuth, ChatController.messages);

routes.post(
  "/chats/:id/messages",
  isAuth,
  authorizeChatUpload,
  receiveChatUpload,
  ChatController.saveMessage
);

routes.post("/chats/:id/read", isAuth, ChatController.checkAsRead);

routes.post("/chats", isAuth, ChatController.store);

routes.post("/chats/direct", isAuth, ChatController.direct);

routes.put("/chats/:id", isAuth, ChatController.update);

routes.delete("/chats/:id", isAuth, ChatController.remove);

export default routes;
