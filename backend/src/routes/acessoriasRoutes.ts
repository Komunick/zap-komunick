import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";
import * as AcessoriasController from "../controllers/AcessoriasController";

const acessoriasRoutes = Router();
const base = "/tickets/:ticketId/acessorias";
acessoriasRoutes.get(
  `${base}/status`,
  isAuth,
  isCompliant,
  AcessoriasController.status
);
acessoriasRoutes.get(
  `${base}/clients`,
  isAuth,
  isCompliant,
  AcessoriasController.clients
);
acessoriasRoutes.get(
  `${base}/catalog`,
  isAuth,
  isCompliant,
  AcessoriasController.catalog
);
acessoriasRoutes.get(
  `${base}/clients/:externalClientId`,
  isAuth,
  isCompliant,
  AcessoriasController.detail
);
acessoriasRoutes.post(
  `${base}/links`,
  isAuth,
  isCompliant,
  AcessoriasController.create
);
acessoriasRoutes.delete(
  `${base}/links/:externalClientId`,
  isAuth,
  isCompliant,
  AcessoriasController.remove
);
export default acessoriasRoutes;
