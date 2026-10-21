import express from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";

import * as KanbanController from "../controllers/KanbanController";

const kanbanRoutes = express.Router();

kanbanRoutes.get("/kanban", isAuth, isCompliant, KanbanController.index);

kanbanRoutes.put(
  "/kanban/tickets/:ticketId",
  isAuth,
  isCompliant,
  KanbanController.move
);

export default kanbanRoutes;
