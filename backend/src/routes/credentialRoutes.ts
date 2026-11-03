import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as CredentialController from "../controllers/CredentialController";

const credentialRoutes = express.Router();
credentialRoutes.get(
  "/credentials",
  isAuth,
  isAdmin,
  CredentialController.index
);
credentialRoutes.post(
  "/credentials/migrate",
  isAuth,
  isAdmin,
  CredentialController.migrate
);
credentialRoutes.get(
  "/credentials/:key",
  isAuth,
  isAdmin,
  CredentialController.show
);
credentialRoutes.put(
  "/credentials/:key",
  isAuth,
  isAdmin,
  CredentialController.update
);
credentialRoutes.delete(
  "/credentials/:key",
  isAuth,
  isAdmin,
  CredentialController.remove
);
export default credentialRoutes;
