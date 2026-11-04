import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";
import * as IntegratedAssistantController from "../controllers/IntegratedAssistantController";

const integratedAssistantRoutes = Router();
const base = "/tickets/:ticketId/integrated-assistant";
integratedAssistantRoutes.get(
  `${base}/status`,
  isAuth,
  isCompliant,
  IntegratedAssistantController.status
);
integratedAssistantRoutes.get(
  `${base}/clients`,
  isAuth,
  isCompliant,
  IntegratedAssistantController.clients
);
integratedAssistantRoutes.post(
  base,
  isAuth,
  isCompliant,
  IntegratedAssistantController.generate
);
integratedAssistantRoutes.post(
  `${base}/review`,
  isAuth,
  isCompliant,
  IntegratedAssistantController.review
);
export default integratedAssistantRoutes;
