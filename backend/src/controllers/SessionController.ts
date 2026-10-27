import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
import { SerializeUser } from "../helpers/SerializeUser";
import { createAccessToken, createRefreshToken } from "../helpers/CreateTokens";
import Company from "../models/Company";
import Setting from "../models/Setting";
import Translation from "../models/Translation";
import { decodeRefreshToken } from "../helpers/DecodeRefreshToken";
import RecordAuditService, {
  auditRequest,
  requestIp
} from "../services/AuditServices/RecordAuditService";
import { checkSignInIp } from "../services/SecurityServices/IpAllowlistService";
import {
  checkSecondFactor,
  consumeChallenge,
  readChallenge
} from "../services/SecurityServices/TwoFactorService";
import { canAccessNow } from "../helpers/AccessHours";

// Zap Komunick: tokens, cookie and event of a successful sign-in, shared by
// the password step and the 2FA step (RF-016)
const finishSignIn = async (
  req: Request,
  res: Response,
  user: User,
  details: Record<string, unknown> = {}
): Promise<Response> => {
  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const serializedUser = await SerializeUser(user);
  SendRefreshToken(res, refreshToken);

  const io = getIO();
  io.to(`user-${serializedUser.id}`).emit(
    `company-${serializedUser.companyId}-auth`,
    {
      action: "update",
      user: {
        id: serializedUser.id,
        email: serializedUser.email,
        companyId: serializedUser.companyId
      }
    }
  );

  RecordAuditService({
    companyId: user.companyId,
    userId: user.id,
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    details,
    ip: requestIp(req),
    userAgent: String(req.headers["user-agent"] || "")
  });

  return res.status(200).json({ token, user: serializedUser });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const langs = await Translation.findAll({
    attributes: ["language"],
    group: ["language"]
  });

  const availableLanguages = langs.map(l => l.language.replace(/_/g, "-"));

  const language = (req.acceptsLanguages(availableLanguages) || null)?.replace(
    /-/g,
    "_"
  );

  const { token, serializedUser, refreshToken, twoFactorChallenge } =
    await AuthUserService({
      email,
      password,
      language,
      ip: requestIp(req),
      userAgent: String(req.headers["user-agent"] || "")
    });

  // Zap Komunick: the password was right; the app code comes next (RF-016)
  if (twoFactorChallenge) {
    return res
      .status(200)
      .json({ twoFactorRequired: true, challenge: twoFactorChallenge });
  }

  SendRefreshToken(res, refreshToken);

  RecordAuditService({
    companyId: serializedUser.companyId,
    userId: serializedUser.id,
    action: "auth.login",
    entity: "user",
    entityId: serializedUser.id,
    details: {},
    ip: requestIp(req),
    userAgent: String(req.headers["user-agent"] || "")
  });

  const io = getIO();
  io.to(`user-${serializedUser.id}`).emit(
    `company-${serializedUser.companyId}-auth`,
    {
      action: "update",
      user: {
        id: serializedUser.id,
        email: serializedUser.email,
        companyId: serializedUser.companyId
      }
    }
  );

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

// Zap Komunick: second step of the sign-in, with the 6-digit code of the app
// or a recovery code (RF-016)
export const verifyTwoFactor = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { challenge, code } = req.body || {};
  const parsedChallenge = await readChallenge(challenge);
  const { id, tv } = parsedChallenge;

  const user = await User.unscoped().findByPk(id, {
    include: ["queues", { model: Company, include: [{ model: Setting }] }]
  });
  if (!user || user.tokenVersion !== tv || !user.twoFactorEnabled) {
    throw new AppError("ERR_2FA_CHALLENGE_EXPIRED", 401);
  }

  const audit = (action: string, details: Record<string, unknown>) =>
    RecordAuditService({
      companyId: user.companyId,
      userId: user.id,
      action,
      entity: "user",
      entityId: user.id,
      details,
      ip: requestIp(req),
      userAgent: String(req.headers["user-agent"] || "")
    });

  if (!canAccessNow(user)) {
    audit("auth.login_failed", { reason: "ERR_OUT_OF_ACCESS_HOURS" });
    throw new AppError("ERR_OUT_OF_ACCESS_HOURS", 401);
  }
  if (!(await checkSignInIp(user.companyId, requestIp(req), user))) {
    audit("auth.login_failed", { reason: "ERR_IP_NOT_ALLOWED" });
    throw new AppError("ERR_IP_NOT_ALLOWED", 403);
  }

  let method: string;
  try {
    method = await checkSecondFactor(user, code);
    await consumeChallenge(parsedChallenge);
    await user.reload();
    if (!user.twoFactorEnabled || user.tokenVersion !== tv) {
      throw new AppError("ERR_2FA_CHALLENGE_EXPIRED", 401);
    }
  } catch (err) {
    audit("auth.2fa_failed", { reason: err?.message });
    throw err;
  }

  return finishSignIn(req, res, user, { twoFactor: method });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token
  );

  // Zap Komunick: the allowlist also holds for sessions already open (RF-016)
  if (!(await checkSignInIp(user.companyId, requestIp(req), user))) {
    res.clearCookie("jrt");
    RecordAuditService({
      companyId: user.companyId,
      userId: user.id,
      action: "auth.ip_blocked",
      entity: "user",
      entityId: user.id,
      details: { on: "refresh" },
      ip: requestIp(req),
      userAgent: String(req.headers["user-agent"] || "")
    });
    throw new AppError("ERR_IP_NOT_ALLOWED", 403);
  }

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  const { id, profile, email, super: superAdmin } = user;

  if (!token) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }

  return res.json({ id, profile, email, super: superAdmin });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  res.clearCookie("jrt");
  if (req.user) {
    auditRequest(req, "auth.logout", "user", req.user.id);
  }

  return res.send();
};

export const impersonate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const { companyId } = req.params;

  if (!token) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }

  const currentRefreshTokenData = decodeRefreshToken(token);

  if (currentRefreshTokenData.impersonated) {
    throw new AppError("ERR_ALREADY_IMPERSONATING", 400);
  }

  const user = await User.findOne({
    where: { companyId: Number(companyId), profile: "admin" },
    include: ["queues", { model: Company, include: [{ model: Setting }] }]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const metadata = {
    originalUserId: Number(req.user.id),
    originalCompanyId: Number(req.user.companyId)
  };

  const newToken = createAccessToken(user, {
    impersonated: true,
    ...metadata
  });
  const refreshToken = createRefreshToken(user, {
    impersonated: true,
    ...metadata
  });
  const serializedUser = await SerializeUser(user);

  SendRefreshToken(res, refreshToken);
  auditRequest(req, "auth.impersonate", "company", companyId, {
    asUserId: user.id
  });

  const io = getIO();
  io.to(`user-${serializedUser.id}`).emit(
    `company-${serializedUser.companyId}-auth`,
    {
      action: "update",
      user: {
        id: serializedUser.id,
        email: serializedUser.email,
        companyId: serializedUser.companyId,
        impersonated: true
      }
    }
  );

  return res.status(200).json({
    token: newToken,
    user: serializedUser
  });
};

export const backToSuper = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }

  const refreshTokenData = decodeRefreshToken(token);

  if (!refreshTokenData.impersonated || !refreshTokenData.originalUserId) {
    throw new AppError("ERR_NOT_IMPERSONATING", 400);
  }

  const originalUser = await User.findByPk(refreshTokenData.originalUserId, {
    include: ["queues", { model: Company, include: [{ model: Setting }] }]
  });

  if (!originalUser || !originalUser.super) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const newToken = createAccessToken(originalUser);
  const newRefreshToken = createRefreshToken(originalUser);
  const serializedUser = await SerializeUser(originalUser);

  SendRefreshToken(res, newRefreshToken);

  return res.status(200).json({
    token: newToken,
    user: serializedUser
  });
};
