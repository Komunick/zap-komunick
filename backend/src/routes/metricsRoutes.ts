import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import isCompliant from "../middleware/isCompliant";

import * as MetricsController from "../controllers/MetricsController";

const metricsRoutes = express.Router();

metricsRoutes.get(
  "/metrics",
  isAuth,
  isAdmin,
  isCompliant,
  MetricsController.show
);

export default metricsRoutes;
