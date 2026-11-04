import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";
import * as AssistantController from "../controllers/AssistantController";

const assistantRoutes = Router();
assistantRoutes.get(
  "/tickets/:ticketId/assistant/status",
  isAuth,
  isCompliant,
  AssistantController.status
);
assistantRoutes.post(
  "/tickets/:ticketId/assistant",
  isAuth,
  isCompliant,
  AssistantController.generate
);
export default assistantRoutes;
