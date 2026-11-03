import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";

import * as SecurityController from "../controllers/SecurityController";
import * as SessionController from "../controllers/SessionController";

// Zap Komunick: 2FA, IP allowlist and audit trail (docs/PRD.md, RF-016)
const securityRoutes = express.Router();

securityRoutes.post("/auth/2fa", SessionController.verifyTwoFactor);

securityRoutes.get("/security/me", isAuth, SecurityController.status);
securityRoutes.post("/security/2fa/setup", isAuth, SecurityController.setup);
securityRoutes.post("/security/2fa/enable", isAuth, SecurityController.enable);
securityRoutes.post(
  "/security/2fa/recovery-codes",
  isAuth,
  SecurityController.recoveryCodes
);
securityRoutes.post(
  "/security/2fa/disable",
  isAuth,
  SecurityController.disable
);
securityRoutes.delete(
  "/users/:userId/2fa",
  isAuth,
  isAdmin,
  SecurityController.resetUser
);

securityRoutes.get(
  "/security/ip-allowlist",
  isAuth,
  isAdmin,
  SecurityController.showAllowlist
);
securityRoutes.put(
  "/security/ip-allowlist",
  isAuth,
  isAdmin,
  SecurityController.updateAllowlist
);

securityRoutes.get(
  "/audit-logs",
  isAuth,
  isAdmin,
  SecurityController.auditLogs
);

export default securityRoutes;
