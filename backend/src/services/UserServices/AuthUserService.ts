import { Sequelize } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import UpdateSettingService from "../SettingServices/UpdateSettingService";
import { canAccessNow } from "../../helpers/AccessHours";
import RecordAuditService from "../AuditServices/RecordAuditService";
import { checkSignInIp } from "../SecurityServices/IpAllowlistService";
import { createChallenge } from "../SecurityServices/TwoFactorService";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number;
}

interface Request {
  email: string;
  password: string;
  language?: string;
  // Zap Komunick: where the sign-in comes from (RF-016)
  ip?: string;
  userAgent?: string;
}

interface Response {
  serializedUser?: SerializedUser;
  token?: string;
  refreshToken?: string;
  // Zap Komunick: the password was right, now the 2FA code is needed
  twoFactorChallenge?: string;
}

const AuthUserService = async ({
  email,
  password,
  language,
  ip,
  userAgent
}: Request): Promise<Response> => {
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }
  const user = await User.unscoped().findOne({
    where: Sequelize.where(
      Sequelize.fn("LOWER", Sequelize.col("email")),
      email.toLowerCase()
    ),
    include: ["queues", { model: Company, include: [{ model: Setting }] }]
  });

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  // Zap Komunick: every refused sign-in of an existing user is audited (RF-016)
  const refuse = (reason: string, status = 401) => {
    RecordAuditService({
      companyId: user.companyId,
      userId: user.id,
      action: "auth.login_failed",
      entity: "user",
      entityId: user.id,
      details: { reason },
      ip,
      userAgent
    });
    return new AppError(reason, status);
  };

  if (!(await user.checkPassword(password))) {
    throw refuse("ERR_INVALID_CREDENTIALS");
  }

  if (!canAccessNow(user)) {
    throw refuse("ERR_OUT_OF_ACCESS_HOURS");
  }

  if (!(await checkSignInIp(user.companyId, ip || "", user))) {
    throw refuse("ERR_IP_NOT_ALLOWED", 403);
  }

  if (user.twoFactorEnabled) {
    return { twoFactorChallenge: createChallenge(user) };
  }

  if (user.super && language) {
    if (!(await GetCompanySetting(1, "defaultLanguage", null))) {
      UpdateSettingService({
        key: "defaultLanguage",
        value: language,
        companyId: 1
      });
    }
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
