import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";
import * as SciController from "../controllers/SciController";

const sciRoutes = Router();
const base = "/tickets/:ticketId/sci";
sciRoutes.get(`${base}/status`, isAuth, isCompliant, SciController.status);
sciRoutes.get(`${base}/clients`, isAuth, isCompliant, SciController.clients);
sciRoutes.get(`${base}/catalog`, isAuth, isCompliant, SciController.catalog);
sciRoutes.get(
  `${base}/clients/:externalClientId`,
  isAuth,
  isCompliant,
  SciController.detail
);
sciRoutes.post(`${base}/links`, isAuth, isCompliant, SciController.create);
sciRoutes.delete(
  `${base}/links/:externalClientId`,
  isAuth,
  isCompliant,
  SciController.remove
);
export default sciRoutes;
