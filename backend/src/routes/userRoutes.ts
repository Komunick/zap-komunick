import { Router } from "express";

import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as UserController from "../controllers/UserController";

const userRoutes = Router();

userRoutes.get("/users", isAuth, UserController.index);

userRoutes.get("/users/list", isAuth, UserController.list);

// Zap Komunick: team online (RF-013)
userRoutes.get("/users/online", isAuth, isAdmin, UserController.online);

userRoutes.post("/users", isAuth, UserController.store);

userRoutes.put("/users/:userId", isAuth, UserController.update);

userRoutes.get("/users/:userId", isAuth, UserController.show);

userRoutes.delete("/users/:userId", isAuth, UserController.remove);

export default userRoutes;
