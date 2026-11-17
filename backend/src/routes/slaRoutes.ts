import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import isCompliant from "../middleware/isCompliant";

import * as SlaController from "../controllers/SlaController";

const slaRoutes = express.Router();

slaRoutes.get("/sla", isAuth, isAdmin, isCompliant, SlaController.panel);
slaRoutes.get("/sla/alert-config", isAuth, isAdmin, SlaController.alertConfig);
slaRoutes.put(
  "/sla/alert-config",
  isAuth,
  isAdmin,
  SlaController.updateAlertConfig
);
slaRoutes.get("/sla/alerts", isAuth, SlaController.alerts);
slaRoutes.put("/sla/alerts/:alertId/read", isAuth, SlaController.readAlert);

export default slaRoutes;
