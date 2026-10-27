import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { QueryTypes, literal } from "sequelize";
import AppError from "../../errors/AppError";
import authConfig from "../../config/auth";
import { cacheLayer } from "../../libs/cache";
import User from "../../models/User";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  matchingTotpCounter
} from "../../helpers/Totp";

// Zap Komunick: two-factor sign-in (docs/PRD.md, RF-016).

const ISSUER = process.env.TWO_FACTOR_ISSUER || "Zap Komunick";
const MAX_FAILURES = 5;
const LOCK_SECONDS = 10 * 60;

// the challenge between the password and the code is signed with a key of
// its own, so it can never be used as an access token
const challengeSecret = () => {
  if (!authConfig.secret) throw new AppError("ERR_SESSION_EXPIRED", 401);
  return `${authConfig.secret}:2fa-challenge`;
};

export const createChallenge = (user: User): string =>
  sign(
    {
      id: user.id,
      purpose: "2fa",
      tv: user.tokenVersion,
      jti: randomBytes(24).toString("hex")
    },
    challengeSecret(),
    { expiresIn: "5m" }
  );

interface Challenge {
  id: number;
  tv: number;
  jti: string;
}

export const readChallenge = async (challenge: unknown): Promise<Challenge> => {
  try {
    const data = verify(String(challenge || ""), challengeSecret(), {
      algorithms: ["HS256"]
    }) as {
      id: number;
      purpose: string;
      tv: number;
      jti: string;
    };
    if (
      data.purpose !== "2fa" ||
      !Number.isInteger(data.id) ||
      !Number.isInteger(data.tv) ||
      !/^[a-f0-9]{48}$/.test(data.jti)
    )
      throw new Error("purpose");
    if (await cacheLayer.get(`2fa:used:${data.jti}`)) throw new Error("used");
    return { id: data.id, tv: data.tv, jti: data.jti };
  } catch {
    throw new AppError("ERR_2FA_CHALLENGE_EXPIRED", 401);
  }
};

export const consumeChallenge = async (challenge: Challenge): Promise<void> => {
  if (!(await cacheLayer.setIfAbsent(`2fa:used:${challenge.jti}`, "1", 300))) {
    throw new AppError("ERR_2FA_CHALLENGE_EXPIRED", 401);
  }
};

const failureKey = (userId: number) => `2fa:failures:${userId}`;

export const assertNotLocked = async (userId: number): Promise<void> => {
  const failures = Number(await cacheLayer.get(failureKey(userId))) || 0;
  if (failures >= MAX_FAILURES) {
    throw new AppError("ERR_2FA_TOO_MANY_ATTEMPTS", 429);
  }
};

const reserveAttempt = async (userId: number): Promise<void> => {
  if (
    (await cacheLayer.incrementWithExpiry(failureKey(userId), LOCK_SECONDS)) >
    MAX_FAILURES
  ) {
    throw new AppError("ERR_2FA_TOO_MANY_ATTEMPTS", 429);
  }
};

const claimTotp = async (
  userId: number,
  secret: string,
  code: unknown
): Promise<boolean> => {
  const counter = matchingTotpCounter(secret, code);
  if (counter === null) return false;
  const fingerprint = createHash("sha256").update(secret).digest("hex");
  return cacheLayer.setIfAbsent(
    `2fa:totp:${userId}:${fingerprint}:${counter}`,
    "1",
    120
  );
};

const checkAuthenticator = async (
  user: User,
  secret: string,
  code: unknown
): Promise<void> => {
  await reserveAttempt(user.id);
  if (!(await claimTotp(user.id, secret, code)))
    throw new AppError("ERR_2FA_INVALID_CODE", 401);
  await cacheLayer.del(failureKey(user.id));
};

/**
 * Checks the second factor: the 6-digit code of the app or one of the
 * recovery codes, which is then used up. Returns how it was proven.
 */
export const checkSecondFactor = async (
  user: User,
  code: unknown
): Promise<"totp" | "recovery"> => {
  await reserveAttempt(user.id);

  if (await claimTotp(user.id, user.twoFactorSecret, code)) {
    await cacheLayer.del(failureKey(user.id));
    return "totp";
  }

  const recovery = normalizeRecoveryCode(code);
  const hashes = user.twoFactorRecoveryCodes || [];
  if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(recovery)) {
    for (let i = 0; i < hashes.length; i += 1) {
      if (await compare(recovery, hashes[i])) {
        const remaining = hashes.filter((_, index) => index !== i);
        // A conditional database update makes one-time recovery atomic across
        // workers, even when both requests loaded the same old user instance.
        // Bind both JSON arrays: Sequelize's JSONB equality serializer inlines
        // hashes and its bind parser then mistakes bcrypt's "$2a" for a bind.
        const [, updated] = await User.sequelize.query(
          `UPDATE "Users"
           SET "twoFactorRecoveryCodes" = CAST($remaining AS jsonb), "updatedAt" = NOW()
           WHERE "id" = $id AND "tokenVersion" = $tokenVersion
             AND "twoFactorEnabled" = true
             AND "twoFactorRecoveryCodes" = CAST($previous AS jsonb)`,
          {
            type: QueryTypes.UPDATE,
            bind: {
              id: user.id,
              tokenVersion: user.tokenVersion,
              previous: JSON.stringify(hashes),
              remaining: JSON.stringify(remaining)
            }
          }
        );
        if (!updated) throw new AppError("ERR_2FA_INVALID_CODE", 401);
        user.twoFactorRecoveryCodes = remaining;
        await cacheLayer.del(failureKey(user.id));
        return "recovery";
      }
    }
  }

  throw new AppError("ERR_2FA_INVALID_CODE", 401);
};

const hashCodes = (codes: string[]) => Promise.all(codes.map(c => hash(c, 8)));

export const startSetup = async (
  user: User
): Promise<{ secret: string; uri: string }> => {
  if (user.twoFactorEnabled) {
    throw new AppError("ERR_2FA_ALREADY_ENABLED", 400);
  }
  await assertNotLocked(user.id);
  const secret = generateTotpSecret();
  await user.update({ twoFactorPendingSecret: secret });
  return { secret, uri: otpauthUri(secret, user.email, ISSUER) };
};

export const confirmSetup = async (
  user: User,
  code: unknown
): Promise<string[]> => {
  if (user.twoFactorEnabled) {
    throw new AppError("ERR_2FA_ALREADY_ENABLED", 400);
  }
  if (!user.twoFactorPendingSecret) {
    throw new AppError("ERR_2FA_NOT_STARTED", 400);
  }
  await checkAuthenticator(user, user.twoFactorPendingSecret, code);
  const codes = generateRecoveryCodes();
  const [updated] = await User.update(
    {
      twoFactorEnabled: true,
      tokenVersion: user.tokenVersion + 1,
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorRecoveryCodes: await hashCodes(codes)
    },
    {
      where: {
        id: user.id,
        tokenVersion: user.tokenVersion,
        twoFactorEnabled: false,
        twoFactorPendingSecret: user.twoFactorPendingSecret
      }
    }
  );
  if (!updated) throw new AppError("ERR_2FA_NOT_STARTED", 400);
  await user.reload();
  return codes;
};

export const newRecoveryCodes = async (
  user: User,
  code: unknown
): Promise<string[]> => {
  if (!user.twoFactorEnabled) {
    throw new AppError("ERR_2FA_NOT_ENABLED", 400);
  }
  await checkAuthenticator(user, user.twoFactorSecret, code);
  const codes = generateRecoveryCodes();
  const [updated] = await User.update(
    { twoFactorRecoveryCodes: await hashCodes(codes) },
    {
      where: {
        id: user.id,
        tokenVersion: user.tokenVersion,
        twoFactorEnabled: true
      }
    }
  );
  if (!updated) throw new AppError("ERR_2FA_NOT_ENABLED", 400);
  await user.reload();
  return codes;
};

export const disableTwoFactor = async (
  user: User,
  password: unknown,
  code: unknown
): Promise<void> => {
  if (!user.twoFactorEnabled) {
    throw new AppError("ERR_2FA_NOT_ENABLED", 400);
  }
  if (!(await user.checkPassword(String(password || "")))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }
  await checkSecondFactor(user, code);
  await resetTwoFactor(user);
};

/** Turns 2FA off (by the user, or by an administrator when the phone is lost). */
export const resetTwoFactor = async (user: User): Promise<void> => {
  await user.update({
    tokenVersion: literal('"tokenVersion" + 1') as unknown as number,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorPendingSecret: null,
    twoFactorRecoveryCodes: null
  });
  await user.reload();
  await cacheLayer.del(failureKey(user.id));
};
