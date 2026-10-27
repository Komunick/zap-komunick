import { Request, Response } from "express";

import AppError from "../errors/AppError";
import User from "../models/User";
import { createRefreshToken } from "../helpers/CreateTokens";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import {
  auditRequest,
  requestIp
} from "../services/AuditServices/RecordAuditService";
import ListAuditLogsService from "../services/AuditServices/ListAuditLogsService";
import {
  getAllowlist,
  saveAllowlist
} from "../services/SecurityServices/IpAllowlistService";
import {
  confirmSetup,
  disableTwoFactor,
  newRecoveryCodes,
  resetTwoFactor,
  startSetup
} from "../services/SecurityServices/TwoFactorService";

// Zap Komunick: 2FA, IP allowlist and audit trail (docs/PRD.md, RF-016)

const currentUser = async (req: Request): Promise<User> => {
  const user = await User.unscoped().findByPk(req.user.id);
  if (!user || user.companyId !== req.user.companyId) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }
  return user;
};

export const status = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await currentUser(req);
  return res.json({
    twoFactorEnabled: !!user.twoFactorEnabled,
    recoveryCodesLeft: (user.twoFactorRecoveryCodes || []).length,
    ip: requestIp(req)
  });
};

export const setup = async (req: Request, res: Response): Promise<Response> => {
  const user = await currentUser(req);
  return res.json(await startSetup(user));
};

export const enable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await currentUser(req);
  const recoveryCodes = await confirmSetup(user, req.body?.code);
  SendRefreshToken(res, createRefreshToken(user));
  auditRequest(req, "security.2fa_enabled", "user", user.id);
  return res.json({ recoveryCodes });
};

export const recoveryCodes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await currentUser(req);
  const codes = await newRecoveryCodes(user, req.body?.code);
  auditRequest(req, "security.2fa_recovery_codes", "user", user.id);
  return res.json({ recoveryCodes: codes });
};

export const disable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await currentUser(req);
  await disableTwoFactor(user, req.body?.password, req.body?.code);
  SendRefreshToken(res, createRefreshToken(user));
  auditRequest(req, "security.2fa_disabled", "user", user.id);
  return res.json({ twoFactorEnabled: false });
};

// an administrator turns 2FA off for someone who lost the phone
export const resetUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (Number(req.params.userId) === Number(req.user.id)) {
    throw new AppError("ERR_2FA_USE_SELF_DISABLE", 403);
  }
  const target = await User.unscoped().findByPk(req.params.userId);
  if (!target || target.companyId !== req.user.companyId) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }
  if (target.super && !req.user.isSuper) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  await resetTwoFactor(target);
  auditRequest(req, "security.2fa_reset", "user", target.id, {
    name: target.name
  });
  return res.json({ twoFactorEnabled: false });
};

export const showAllowlist = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const allowlist = await getAllowlist(req.user.companyId);
  return res.json({ ...allowlist, ip: requestIp(req) });
};

export const updateAllowlist = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const saved = await saveAllowlist({
    companyId: req.user.companyId,
    enabled: req.body?.enabled === true,
    text: String(req.body?.text || ""),
    currentIp: requestIp(req),
    isSuper: !!req.user.isSuper
  });
  auditRequest(
    req,
    "security.ip_allowlist_updated",
    "company",
    req.user.companyId,
    {
      enabled: saved.enabled,
      entries: saved.entries
    }
  );
  return res.json({ ...saved, ip: requestIp(req) });
};

export const auditLogs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await ListAuditLogsService({
    companyId: req.user.companyId,
    pageNumber: req.query.pageNumber,
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId,
    action: req.query.action
  });
  return res.json(result);
};
