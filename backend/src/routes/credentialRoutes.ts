import express from "express";
import isAuth from "../middleware/isAuth";
import * as CredentialController from "../controllers/CredentialController";

const credentialRoutes = express.Router();
credentialRoutes.get("/credentials", isAuth, CredentialController.index);
credentialRoutes.post(
  "/credentials/migrate",
  isAuth,
  CredentialController.migrate
);
credentialRoutes.get("/credentials/:key", isAuth, CredentialController.show);
credentialRoutes.put("/credentials/:key", isAuth, CredentialController.update);
credentialRoutes.delete(
  "/credentials/:key",
  isAuth,
  CredentialController.remove
);
export default credentialRoutes;
