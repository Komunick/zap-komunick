import { Request, Response } from "express";
import Setting from "../../models/Setting";
import GetPublicSettingService from "../../services/SettingServices/GetPublicSettingService";
import { manifest } from "../../controllers/PwaController";
import { version } from "../../controllers/VersionController";

jest.mock("../../models/Setting", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  destroy: jest.fn()
}));
jest.mock("../../gitinfo", () => ({
  GitInfo: {
    commitHash: "fixture-source",
    tagName: "fixture-version"
  }
}));
jest.mock("../../models/User", () => ({
  update: jest.fn(),
  sequelize: { query: jest.fn() }
}));
jest.mock("../../config/auth", () => ({
  secret: "fictional-setup-test-key"
}));
jest.mock("../../libs/cache", () => ({
  cacheLayer: { get: jest.fn() }
}));

const request = {} as Request;
const response = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  }) as unknown as Response;
const storedName = (value?: string) => {
  (Setting.findOne as jest.Mock).mockImplementation(async ({ where }) => {
    if (where.key === "appName") return value === undefined ? null : { value };
    return null;
  });
};
const expectNoSettingWrites = () => {
  [Setting.create, Setting.update, Setting.upsert, Setting.destroy].forEach(
    write => expect(write).not.toHaveBeenCalled()
  );
};

beforeEach(() => jest.clearAllMocks());

describe("public product name compatibility", () => {
  it.each([
    [undefined, "SuperChat"],
    ["", "SuperChat"],
    ["Zap Komunick", "SuperChat"],
    ["  ZAP KOMUNICK  ", "SuperChat"],
    ["Ticketz", "SuperChat"],
    ["whitelabel chat", "SuperChat"],
    ["Portal Zap Komunick", "Portal SuperChat"],
    ["Equipe Aurora", "Equipe Aurora"]
  ])(
    "presents stored appName %p as %s without rewriting it",
    async (value, expected) => {
      storedName(value);
      await expect(GetPublicSettingService({ key: "appName" })).resolves.toBe(
        expected
      );
      expect(Setting.findOne).toHaveBeenCalledTimes(1);
      expect(Setting.findOne).toHaveBeenCalledWith({
        where: { companyId: 1, key: "appName" }
      });
      expectNoSettingWrites();
    }
  );

  it.each([
    ["appLogoLight", "Zap Komunick.svg"],
    ["appLogoDark", "custom-dark.svg"],
    ["appLogoFavicon", "custom-icon.png"],
    ["loginPageLinks", '[{"title":"Zap Komunick","url":"/manual"}]'],
    ["primaryColorLight", "#123456"]
  ])("keeps public %s content and uploads unchanged", async (key, value) => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value });
    await expect(GetPublicSettingService({ key })).resolves.toBe(value);
    expectNoSettingWrites();
  });

  it.each(["privateKey", "_secret", "aiApiKey"])(
    "keeps non-public setting %s outside the public lookup",
    async key => {
      await expect(GetPublicSettingService({ key })).resolves.toBeNull();
      expect(Setting.findOne).not.toHaveBeenCalled();
      expectNoSettingWrites();
    }
  );

  it("keeps absent non-name settings null", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      GetPublicSettingService({ key: "appLogoLight" })
    ).resolves.toBeNull();
    expectNoSettingWrites();
  });

  it("propagates a failed settings read instead of hiding a database error", async () => {
    const error = new Error("fictional settings failure");
    (Setting.findOne as jest.Mock).mockRejectedValue(error);
    await expect(GetPublicSettingService({ key: "appName" })).rejects.toBe(
      error
    );
    expectNoSettingWrites();
  });
});

describe("PWA and version names use the real public settings reader", () => {
  it.each([
    [undefined, "SuperChat"],
    ["", "SuperChat"],
    ["Zap Komunick", "SuperChat"],
    ["Ticketz", "SuperChat"],
    ["Ticketz - Chat Based Ticket System", "SuperChat"],
    ["Portal Zap Komunick", "Portal SuperChat"],
    ["Equipe Aurora", "Equipe Aurora"]
  ])("returns the effective name for persisted %p", async (value, expected) => {
    storedName(value);
    const pwa = response();
    const info = response();
    await manifest(request, pwa);
    await version(request, info);
    expect(pwa.status).toHaveBeenCalledWith(200);
    expect(pwa.json).toHaveBeenCalledWith(
      expect.objectContaining({ short_name: expected, name: expected })
    );
    expect(info.status).toHaveBeenCalledWith(200);
    expect(info.json).toHaveBeenCalledWith({
      name: expected,
      commitHash: "fixture-source",
      tagName: "fixture-version"
    });
    expectNoSettingWrites();
  });

  it.each([
    [undefined, "/vector/favicon.svg", "image/svg+xml"],
    ["custom-icon.png", "/backend/public/custom-icon.png", "image/png"]
  ])("preserves the PWA icon contract for %p", async (icon, src, type) => {
    (Setting.findOne as jest.Mock).mockImplementation(async ({ where }) => {
      const value = where.key === "appName" ? "Zap Komunick" : icon;
      return value ? { value } : null;
    });
    const res = response();
    await manifest(request, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        icons: [expect.objectContaining({ src, type })]
      })
    );
    expectNoSettingWrites();
  });

  it.each([manifest, version])(
    "preserves read errors in %p",
    async controller => {
      const error = new Error("fictional settings failure");
      (Setting.findOne as jest.Mock).mockRejectedValue(error);
      const res = response();
      await expect(controller(request, res)).rejects.toBe(error);
      expect(res.json).not.toHaveBeenCalled();
      expectNoSettingWrites();
    }
  );
});

describe("new authenticator labels", () => {
  const previousIssuer = process.env.TWO_FACTOR_ISSUER;

  afterEach(() => {
    if (previousIssuer === undefined) delete process.env.TWO_FACTOR_ISSUER;
    else process.env.TWO_FACTOR_ISSUER = previousIssuer;
  });

  it.each([
    [undefined, "SuperChat"],
    ["Zap Komunick", "SuperChat"],
    ["Ticketz", "SuperChat"],
    ["Equipe Aurora", "Equipe Aurora"]
  ])("uses %s only as the new setup label", async (issuer, expected) => {
    if (issuer === undefined) delete process.env.TWO_FACTOR_ISSUER;
    else process.env.TWO_FACTOR_ISSUER = issuer;
    let startSetup: typeof import("../../services/SecurityServices/TwoFactorService").startSetup;
    jest.isolateModules(() => {
      jest
        .requireMock("../../libs/cache")
        .cacheLayer.get.mockResolvedValue(null);
      startSetup = jest.requireActual(
        "../../services/SecurityServices/TwoFactorService"
      ).startSetup;
    });
    const user = {
      id: 7,
      email: "fixture@example.test",
      twoFactorEnabled: false,
      twoFactorSecret: "existing-fictional-secret",
      twoFactorRecoveryCodes: ["existing-fictional-recovery-hash"],
      tokenVersion: 19,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const setup = await startSetup(user as never);
    const uri = new URL(setup.uri);
    expect(uri.searchParams.get("issuer")).toBe(expected);
    expect(decodeURIComponent(uri.pathname)).toBe(
      `/${expected}:fixture@example.test`
    );
    expect(uri.searchParams.get("secret")).toBe(setup.secret);
    expect(uri.searchParams.get("algorithm")).toBe("SHA1");
    expect(uri.searchParams.get("period")).toBe("30");
    expect(uri.searchParams.get("digits")).toBe("6");
    expect(user.update).toHaveBeenCalledWith({
      twoFactorPendingSecret: setup.secret
    });
    expect(user.twoFactorSecret).toBe("existing-fictional-secret");
    expect(user.twoFactorRecoveryCodes).toEqual([
      "existing-fictional-recovery-hash"
    ]);
    expect(user.tokenVersion).toBe(19);
  });
});
