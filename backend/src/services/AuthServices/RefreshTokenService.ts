import { Response as Res } from "express";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import {
  decodeRefreshToken,
  RefreshTokenPayload
} from "../../helpers/DecodeRefreshToken";
import { canAccessNow } from "../../helpers/AccessHours";

interface Response {
  user: User;
  newToken: string;
  refreshToken: string;
}

export const RefreshTokenService = async (
  res: Res,
  token: string
): Promise<Response> => {
  let result: Response;
  let impersonatedSession = false;

  try {
    const decoded = decodeRefreshToken(token);
    const {
      id,
      tokenVersion,
      impersonated,
      originalUserId,
      originalCompanyId
    } = decoded as RefreshTokenPayload;

    const user = await ShowUserService(id);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const newToken = createAccessToken(user, {
      impersonated: impersonated === true,
      originalUserId,
      originalCompanyId
    });
    const refreshToken = createRefreshToken(user, {
      impersonated: impersonated === true,
      originalUserId,
      originalCompanyId
    });

    impersonatedSession = impersonated === true;
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
