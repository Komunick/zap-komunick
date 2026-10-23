import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";

import * as CloseReasonController from "../controllers/CloseReasonController";

const closeReasonRoutes = express.Router();

closeReasonRoutes.get(
  "/close-reasons/report",
  isAuth,
  isAdmin,
  CloseReasonController.report
);

closeReasonRoutes.get("/close-reasons", isAuth, CloseReasonController.index);

closeReasonRoutes.post(
  "/close-reasons",
  isAuth,
  isAdmin,
  CloseReasonController.store
);

closeReasonRoutes.put(
  "/close-reasons/:closeReasonId",
  isAuth,
  isAdmin,
  CloseReasonController.update
);

closeReasonRoutes.delete(
  "/close-reasons/:closeReasonId",
  isAuth,
  isAdmin,
  CloseReasonController.remove
);

export default closeReasonRoutes;
