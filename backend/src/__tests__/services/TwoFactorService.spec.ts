import { hash } from "bcryptjs";
import { DataTypes, QueryTypes, Sequelize } from "sequelize";
import { cacheLayer } from "../../libs/cache";
import User from "../../models/User";
import { base32Encode, totp } from "../../helpers/Totp";
import {
  checkSecondFactor,
  confirmSetup,
  consumeChallenge,
  createChallenge,
  newRecoveryCodes,
  readChallenge,
  resetTwoFactor
} from "../../services/SecurityServices/TwoFactorService";

jest.mock("../../config/auth", () => ({
  secret: "test-key-not-a-real-secret"
}));
jest.mock("../../models/User", () => ({
  update: jest.fn(),
  sequelize: { query: jest.fn() }
}));
jest.mock("../../libs/cache", () => ({
  cacheLayer: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setIfAbsent: jest.fn(),
    incrementWithExpiry: jest.fn()
  }
}));

const secret = base32Encode(Buffer.from("12345678901234567890"));
const now = 1800000000000;

describe("two-factor security", () => {
  let entries: Map<string, string>;
  let user: User;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(now);
    entries = new Map();
    (cacheLayer.get as jest.Mock).mockImplementation(async key =>
      entries.get(key)
    );
    (cacheLayer.set as jest.Mock).mockImplementation(async (key, value) => {
      entries.set(key, value);
      return "OK";
    });
    (cacheLayer.del as jest.Mock).mockImplementation(async key =>
      entries.delete(key)
    );
    (
      cacheLayer as unknown as { setIfAbsent: jest.Mock }
    ).setIfAbsent.mockImplementation(async (key, value) => {
      if (entries.has(key)) return false;
      entries.set(key, value);
      return true;
    });
    (
      cacheLayer as unknown as { incrementWithExpiry: jest.Mock }
    ).incrementWithExpiry.mockImplementation(async key => {
      const value = Number(entries.get(key) || 0) + 1;
      entries.set(key, String(value));
      return value;
    });
    user = {
      id: 42,
      companyId: 7,
      tokenVersion: 0,
      email: "fixture@example.test",
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorPendingSecret: secret,
      twoFactorRecoveryCodes: [],
      update: jest.fn(async values => {
        if (values.tokenVersion && typeof values.tokenVersion === "object") {
          values.tokenVersion = user.tokenVersion + 1;
        }
        Object.assign(user, values);
        return user;
      }),
      reload: jest.fn(async () => user)
    } as unknown as User;
    (User.update as jest.Mock).mockImplementation(async values => {
      Object.assign(user, values);
      return [1];
    });
    (User.sequelize.query as jest.Mock).mockResolvedValue([[], 1]);
  });

  afterEach(() => jest.restoreAllMocks());

  it("creates a different challenge for each password verification", () => {
    expect(createChallenge(user) === createChallenge(user)).toBe(false);
  });

  it("consumes a challenge once and refuses subsequent verification", async () => {
    const encoded = createChallenge(user);
    const challenge = await readChallenge(encoded);
    const consumed = await Promise.allSettled([
      consumeChallenge(challenge),
      consumeChallenge(challenge)
    ]);
    expect(
      consumed.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    await expect(readChallenge(encoded)).rejects.toMatchObject({
      message: "ERR_2FA_CHALLENGE_EXPIRED"
    });
  });

  it("accepts only one simultaneous submission of the same TOTP", async () => {
    const results = await Promise.allSettled([
      checkSecondFactor(user, totp(secret, now)),
      checkSecondFactor(user, totp(secret, now))
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
  });

  it("bounds parallel invalid attempts and refuses a valid code after five failures", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => checkSecondFactor(user, "wrong"))
    );
    expect(
      results.filter(
        result =>
          result.status === "rejected" &&
          result.reason.message === "ERR_2FA_TOO_MANY_ATTEMPTS"
      )
    ).toHaveLength(3);
    await expect(
      checkSecondFactor(user, totp(secret, now))
    ).rejects.toMatchObject({ message: "ERR_2FA_TOO_MANY_ATTEMPTS" });
  });

  it("expires challenges after five minutes", async () => {
    const challenge = createChallenge(user);
    jest.spyOn(Date, "now").mockReturnValue(now + 301000);
    await expect(
      Promise.resolve().then(() => readChallenge(challenge))
    ).rejects.toMatchObject({ message: "ERR_2FA_CHALLENGE_EXPIRED" });
  });

  it("does not accept the same authenticator code twice", async () => {
    await expect(checkSecondFactor(user, totp(secret, now))).resolves.toBe(
      "totp"
    );
    await expect(
      checkSecondFactor(user, totp(secret, now))
    ).rejects.toMatchObject({ message: "ERR_2FA_INVALID_CODE" });
  });

  it("consumes a recovery code only once across simultaneous requests", async () => {
    const recoveryHash = await hash("ABCD-2345", 4);
    user.twoFactorRecoveryCodes = [recoveryHash];
    let consumed = false;
    (User.sequelize.query as jest.Mock).mockImplementation(async () => {
      if (consumed) return [[], 0];
      consumed = true;
      return [[], 1];
    });
    const results = await Promise.allSettled([
      checkSecondFactor(user, "ABCD-2345"),
      checkSecondFactor(user, "ABCD-2345")
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
  });

  it("passes bcrypt recovery hashes through PostgreSQL bind parsing as data", async () => {
    const recoveryHash = await hash("ABCD-2345", 8);
    user.twoFactorRecoveryCodes = [recoveryHash];
    const database = new Sequelize("fixture", "fixture", "fixture", {
      dialect: "postgres",
      logging: false
    });
    const StoredUser = database.define("User", {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      tokenVersion: DataTypes.INTEGER,
      twoFactorEnabled: DataTypes.BOOLEAN,
      twoFactorRecoveryCodes: DataTypes.JSONB
    });
    // Exercise the installed driver's parser without opening a connection.
    const PostgresQuery = (
      database as unknown as {
        dialect: {
          Query: {
            formatBindParameters(
              sql: string,
              bind: unknown,
              dialect: string
            ): [string, unknown[]];
          };
        };
      }
    ).dialect.Query;
    jest.spyOn(database, "query").mockImplementation((async (
      statement,
      options
    ) => {
      const text = typeof statement === "string" ? statement : statement.query;
      const binds =
        typeof statement === "string" ? options.bind : statement.bind;
      const [sql, parameters] = PostgresQuery.formatBindParameters(
        text,
        binds,
        "postgres"
      );
      expect(sql).not.toContain(recoveryHash);
      expect(parameters).toContain(JSON.stringify([recoveryHash]));
      return options.type === QueryTypes.UPDATE ? [[], 1] : 1;
    }) as typeof database.query);
    (User.update as jest.Mock).mockImplementation((values, options) =>
      StoredUser.update(values, options)
    );
    (User.sequelize.query as jest.Mock).mockImplementation((sql, options) =>
      database.query(sql, options)
    );

    await expect(checkSecondFactor(user, "ABCD-2345")).resolves.toBe(
      "recovery"
    );
    expect(user.twoFactorRecoveryCodes).toEqual([]);
  });

  it("locks setup confirmation after five invalid codes", async () => {
    user.twoFactorEnabled = false;
    for (let i = 0; i < 5; i += 1) {
      await expect(confirmSetup(user, "wrong")).rejects.toMatchObject({
        message: "ERR_2FA_INVALID_CODE"
      });
    }
    await expect(confirmSetup(user, totp(secret, now))).rejects.toMatchObject({
      message: "ERR_2FA_TOO_MANY_ATTEMPTS"
    });
  });

  it("invalidates old refresh tokens when enabling or resetting 2FA", async () => {
    user.twoFactorEnabled = false;
    await confirmSetup(user, totp(secret, now));
    expect(user.tokenVersion).toBe(1);
    await resetTwoFactor(user);
    expect(user.tokenVersion).toBe(2);
  });

  it("does not enable setup after an administrator reset changed the stored state", async () => {
    user.twoFactorEnabled = false;
    (User.update as jest.Mock).mockResolvedValue([0]);
    await expect(confirmSetup(user, totp(secret, now))).rejects.toMatchObject({
      message: "ERR_2FA_NOT_STARTED"
    });
    expect(user.twoFactorEnabled).toBe(false);
  });

  it("does not put recovery codes back after a concurrent reset", async () => {
    (User.update as jest.Mock).mockResolvedValue([0]);
    await expect(
      newRecoveryCodes(user, totp(secret, now))
    ).rejects.toMatchObject({ message: "ERR_2FA_NOT_ENABLED" });
  });

  it("does not regenerate recovery codes with a previously used authenticator code", async () => {
    await checkSecondFactor(user, totp(secret, now));
    await expect(
      newRecoveryCodes(user, totp(secret, now))
    ).rejects.toMatchObject({ message: "ERR_2FA_INVALID_CODE" });
  });
});
