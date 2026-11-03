import { NextFunction, Request, Response } from "express";
import { JwtPayload, verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import AppError from "../errors/AppError";
import { positiveChatId } from "../helpers/ChatAuthorization";
import { canAccessNow } from "../helpers/AccessHours";
import { requestIp } from "../services/AuditServices/RecordAuditService";
import { checkSignInIp } from "../services/SecurityServices/IpAllowlistService";
import User from "../models/User";

interface MediaIdentity {
  userId: number;
  companyId: number;
  tokenVersion?: number;
  impersonated: boolean;
}

function identity(token: unknown, cookie: boolean): MediaIdentity {
  try {
    const secret = cookie ? authConfig.refreshSecret : authConfig.secret;
    if (typeof token !== "string" || !token || !secret) throw new Error();
    const decoded = verify(token, secret) as JwtPayload;
    const userId = positiveChatId(decoded.id),
      companyId = positiveChatId(decoded.companyId);
    if (
      !userId ||
      !companyId ||
      !Number.isSafeInteger(decoded.exp) ||
      (cookie &&
        (!Number.isSafeInteger(decoded.tokenVersion) ||
          decoded.tokenVersion < 0))
    )
      throw new Error();
    return {
      userId,
      companyId,
      ...(cookie ? { tokenVersion: decoded.tokenVersion } : {}),
      impersonated: decoded.impersonated === true
    };
  } catch {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
}

// Zap Komunick: cookie authentication is restricted to native chat media.
// Simultaneous credentials must both be valid and identify the same actor.
export default async function authenticateChatMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("Cookie");
  res.append("Access-Control-Expose-Headers", "Content-Disposition");
  const headerPresent = req.headers.authorization !== undefined;
  const cookiePresent = Object.prototype.hasOwnProperty.call(
    req.cookies || {},
    "jrt"
  );
  if (!headerPresent && !cookiePresent)
    throw new AppError("ERR_UNAUTHORIZED", 401);
  let bearer: MediaIdentity;
  if (headerPresent) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || "");
    if (!match) throw new AppError("ERR_SESSION_EXPIRED", 401);
    bearer = identity(match[1], false);
  }
  const cookie = cookiePresent ? identity(req.cookies.jrt, true) : undefined;
  if (
    bearer &&
    cookie &&
    (bearer.userId !== cookie.userId || bearer.companyId !== cookie.companyId)
  )
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  const actor = bearer || cookie;
  const user = await User.findOne({
    where: { id: actor.userId, companyId: actor.companyId },
    attributes: [
      "id",
      "companyId",
      "tokenVersion",
      "profile",
      "super",
      "accessHours"
    ]
  });
  if (
    !user ||
    user.companyId !== actor.companyId ||
    (cookie && cookie.tokenVersion !== user.tokenVersion)
  )
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  if (!(bearer?.impersonated || cookie?.impersonated) && !canAccessNow(user))
    throw new AppError("ERR_OUT_OF_ACCESS_HOURS", 401);
  if (!(await checkSignInIp(user.companyId, requestIp(req), user)))
    throw new AppError("ERR_IP_NOT_ALLOWED", 403);
  req.user = {
    id: String(user.id),
    companyId: user.companyId,
    profile: user.profile,
    isSuper: user.super
  };
  req.companyId = user.companyId;
  next();
}
