import { randomBytes } from "crypto";
import { cacheLayer } from "../libs/cache";
import { logger } from "../utils/logger";

type JwtConfig = {
  secret: string | null;
  expiresIn: string;
  refreshSecret: string | null;
  refreshExpiresIn: string;
};

const CACHE_KEY_JWT_SECRET = "TICKETZ_JWT_SECRET";
const CACHE_KEY_JWT_REFRESH_SECRET = "TICKETZ_JWT_REFRESH_SECRET";

// Zap Komunick: the secrets sign every login token, so they come from the
// cryptographic generator (Math.random is predictable) and are never logged
function generateSecret(length: number): string {
  return randomBytes(length).toString("base64");
}

async function generateSecretIfNotExists(cacheKey: string): Promise<string> {
  let secret = await cacheLayer.get(cacheKey);
  if (!secret) {
    secret = generateSecret(32);
    await cacheLayer.set(cacheKey, secret);
    logger.debug(`[auth.ts] Generated ${cacheKey}`);
  } else {
    logger.debug(`[auth.ts] Loaded ${cacheKey}`);
  }
  return secret;
}

const jwtConfig: JwtConfig = {
  secret: null,
  expiresIn: "15m",
  refreshSecret: null,
  refreshExpiresIn: "7d"
};

const secretPromise = generateSecretIfNotExists(CACHE_KEY_JWT_SECRET);
const refreshSecretPromise = generateSecretIfNotExists(
  CACHE_KEY_JWT_REFRESH_SECRET
);

Promise.all([secretPromise, refreshSecretPromise]).then(
  ([secret, refreshSecret]) => {
    jwtConfig.secret = secret;
    jwtConfig.refreshSecret = refreshSecret;
  }
);

export default jwtConfig;
