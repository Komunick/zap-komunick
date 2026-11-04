import { Response as Res } from "express";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import {
  createAccessToken,
  createRefreshToken,
  ImpersonationMetadata
} from "../../helpers/CreateTokens";
import {
  decodeRefreshToken,
  RefreshTokenPayload
} from "../../helpers/DecodeRefreshToken";
import { canAccessNow } from "../../helpers/AccessHours";
import RecordAuditService from "../AuditServices/RecordAuditService";
import {
  assertImpersonationDestinationIp,
  validateImpersonatedRefresh
} from "./ImpersonationService";

interface Response {
  user: User;
  newToken: string;
  refreshToken: string;
}

export const RefreshTokenService = async (
  res: Res,
  token: string,
  ip = "",
  userAgent = ""
): Promise<Response> => {
  let result: Response;
  let user: User;
  let metadata: ImpersonationMetadata = {};
  let impersonatedSession = false;

  try {
    const decoded = decodeRefreshToken(token);
    const { id, tokenVersion, impersonated } = decoded as RefreshTokenPayload;

    user = await ShowUserService(id);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    impersonatedSession = impersonated === true;
    if (impersonatedSession) {
      metadata = await validateImpersonatedRefresh(decoded, user);
    }
  } catch {
    res.clearCookie("jrt");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  // Preserve the destination's IP error and refuse it before signing new tokens.
  if (impersonatedSession) {
    try {
      await assertImpersonationDestinationIp(user, ip);
    } catch (error) {
      if (error instanceof AppError && error.message === "ERR_IP_NOT_ALLOWED") {
        res.clearCookie("jrt");
        RecordAuditService({
          companyId: user.companyId,
          userId: user.id,
          action: "auth.ip_blocked",
          entity: "user",
          entityId: user.id,
          details: { on: "refresh" },
          ip,
          userAgent
        });
      }
      throw error;
    }
  }

  try {
    const newToken = createAccessToken(user, metadata);
    const refreshToken = createRefreshToken(user, metadata);
    result = { user, newToken, refreshToken };
  } catch {
    res.clearCookie("jrt");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  // Zap Komunick: access hours also end sessions already open
  if (!impersonatedSession && !canAccessNow(result.user)) {
    res.clearCookie("jrt");
    throw new AppError("ERR_OUT_OF_ACCESS_HOURS", 401);
  }

  return result;
};
