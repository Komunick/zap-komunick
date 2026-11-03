import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import isCompliant from "../middleware/isCompliant";

import * as SlaController from "../controllers/SlaController";

const slaRoutes = express.Router();

slaRoutes.get("/sla", isAuth, isAdmin, isCompliant, SlaController.panel);

export default slaRoutes;
