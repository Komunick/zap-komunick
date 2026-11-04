import { verify } from "jsonwebtoken";
import authConfig from "../../config/auth";
import AppError from "../../errors/AppError";
import { ImpersonationMetadata } from "../../helpers/CreateTokens";
import {
  decodeRefreshToken,
  RefreshTokenPayload
} from "../../helpers/DecodeRefreshToken";
import {
  currentAccessMatches,
  impersonationOrigin,
  ImpersonationClaims,
  positiveSessionId,
  sessionPairMatches,
  validTokenVersion
} from "../../helpers/ImpersonationRules";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import User from "../../models/User";
import { checkSignInIp } from "../SecurityServices/IpAllowlistService";

interface SessionRequest {
  authorization: unknown;
  refreshToken: unknown;
  ip: string;
}

const identityAttributes = [
  "id",
  "companyId",
  "profile",
  "super",
  "tokenVersion"
];
const publicAttributes = [
  ...identityAttributes,
  "name",
  "email",
  "accessHours",
  "twoFactorEnabled"
];
const associations = [
  "queues",
  { model: Company, include: [{ model: Setting }] }
];
const expired = () => new AppError("ERR_SESSION_EXPIRED", 401);

function readAccess(authorization: unknown): ImpersonationClaims {
  if (
    typeof authorization !== "string" ||
    !/^Bearer \S+$/i.test(authorization)
  ) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }
  try {
    const decoded = verify(authorization.split(" ")[1], authConfig.secret);
    if (!decoded || typeof decoded !== "object") throw expired();
    return decoded as ImpersonationClaims;
  } catch {
    throw expired();
  }
}

// Changing 2FA revokes a delegated session instead of converting it to normal.
export function isImpersonatedAccess(authorization: unknown): boolean {
  return readAccess(authorization).impersonated === true;
}

function readPair({ authorization, refreshToken }: SessionRequest) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new AppError("ERR_UNAUTHORIZED", 401);
  }
  const access = readAccess(authorization);
  const refresh = decodeRefreshToken(refreshToken);
  if (!sessionPairMatches(access, refresh)) throw expired();
  return { access, refresh };
}

async function currentUser(
  access: ImpersonationClaims,
  refresh: RefreshTokenPayload,
  denialStatus: 401 | 403
): Promise<User> {
  const user = await User.findOne({
    where: {
      id: positiveSessionId(access.id),
      companyId: positiveSessionId(access.companyId)
    },
    attributes: identityAttributes
  });
  if (!user || !currentAccessMatches(access, user)) {
    throw new AppError(
      denialStatus === 403 ? "ERR_NO_PERMISSION" : "ERR_SESSION_EXPIRED",
      denialStatus
    );
  }
  if (
    !validTokenVersion(refresh.tokenVersion) ||
    user.tokenVersion !== refresh.tokenVersion
  )
    throw expired();
  return user;
}

async function originUser(
  claims: ImpersonationClaims,
  full = false
): Promise<User> {
  const origin = impersonationOrigin(claims);
  if (!origin) throw expired();
  const user = await User.findOne({
    where: { id: origin.originalUserId, companyId: origin.originalCompanyId },
    attributes: full ? publicAttributes : identityAttributes,
    ...(full ? { include: associations } : {})
  });
  if (
    !user ||
    user.id !== origin.originalUserId ||
    user.companyId !== origin.originalCompanyId ||
    user.super !== true ||
    user.tokenVersion !== origin.originalTokenVersion
  )
    throw expired();
  return user;
}

export async function assertImpersonationDestinationIp(
  user: User,
  ip: string
): Promise<void> {
  if (!(await checkSignInIp(user.companyId, ip, user))) {
    throw new AppError("ERR_IP_NOT_ALLOWED", 403);
  }
}

export async function beginImpersonation(
  request: SessionRequest & { companyId: unknown }
): Promise<{ user: User; metadata: ImpersonationMetadata }> {
  const { access, refresh } = readPair(request);
  if (refresh.impersonated === true)
    throw new AppError("ERR_ALREADY_IMPERSONATING", 400);
  const actor = await currentUser(access, refresh, 403);
  if (actor.super !== true) throw new AppError("ERR_NO_PERMISSION", 403);
  const companyId =
    typeof request.companyId === "string"
      ? positiveSessionId(request.companyId)
      : undefined;
  if (!companyId) throw new AppError("ERR_BAD_REQUEST", 400);
  const user = await User.findOne({
    where: { companyId, profile: "admin" },
    attributes: publicAttributes,
    include: associations,
    order: [["id", "ASC"]]
  });
  if (!user) throw new AppError("ERR_NO_USER_FOUND", 404);
  await assertImpersonationDestinationIp(user, request.ip);
  return {
    user,
    metadata: {
      impersonated: true,
      originalUserId: actor.id,
      originalCompanyId: actor.companyId,
      originalTokenVersion: actor.tokenVersion
    }
  };
}

export async function returnFromImpersonation(
  request: SessionRequest
): Promise<User> {
  const { access, refresh } = readPair(request);
  if (refresh.impersonated !== true)
    throw new AppError("ERR_NOT_IMPERSONATING", 400);
  await currentUser(access, refresh, 401);
  const user = await originUser(refresh, true);
  await assertImpersonationDestinationIp(user, request.ip);
  return user;
}

// Called only for delegated refreshes; ordinary sign-in/refresh rules stay intact.
export async function validateImpersonatedRefresh(
  claims: RefreshTokenPayload,
  user: User
): Promise<ImpersonationMetadata> {
  const origin = impersonationOrigin(claims);
  if (
    !origin ||
    user.id !== positiveSessionId(claims.id) ||
    user.companyId !== positiveSessionId(claims.companyId) ||
    user.profile !== "admin" ||
    !validTokenVersion(claims.tokenVersion) ||
    user.tokenVersion !== claims.tokenVersion
  )
    throw expired();
  await originUser(claims);
  return { impersonated: true, ...origin };
}
