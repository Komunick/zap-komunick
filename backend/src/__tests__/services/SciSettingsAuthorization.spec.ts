import { Request, Response } from "express";
import { GetSettingService } from "../../services/SettingServices/GetSettingService";
import { update } from "../../controllers/SettingController";
import UpdateSettingService from "../../services/SettingServices/UpdateSettingService";
import Setting from "../../models/Setting";
import User from "../../models/User";

jest.mock("../../models/Setting", () => ({
  findOne: jest.fn(),
  findAll: jest.fn()
}));
jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../models/Contact", () => ({}));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../services/SettingServices/UpdateSettingService", () =>
  jest.fn()
);
jest.mock("../../services/SettingServices/ListSettingsService", () =>
  jest.fn()
);
jest.mock("../../services/SettingServices/GetPublicSettingService", () =>
  jest.fn()
);
jest.mock("../../services/SecurityServices/IpAllowlistService", () => ({
  IP_ALLOWLIST_KEYS: []
}));
jest.mock("../../services/AuditServices/RecordAuditService", () => ({
  auditRequest: jest.fn()
}));
jest.mock("../../utils/shutdown", () => ({
  triggerGracefulShutdown: jest.fn()
}));

const actor = { id: "101", companyId: 10, profile: "admin" };
const current = (profile = "admin", companyId = 10) => ({
  id: 101,
  companyId,
  profile,
  queues: []
});
const req = (key: string) =>
  ({
    params: { settingKey: key },
    body: { value: "enabled", companyId: 20 },
    user: actor
  }) as unknown as Request;

describe.each(["sciEnabled", "integratedAssistantEnabled"])(
  "%s uses the current company and administrator rather than JWT role alone",
  key => {
    beforeEach(() => {
      jest.clearAllMocks();
      (User.findOne as jest.Mock).mockResolvedValue(current());
      (Setting.findAll as jest.Mock).mockResolvedValue([]);
      (UpdateSettingService as jest.Mock).mockResolvedValue({
        key,
        value: "enabled",
        companyId: 10
      });
    });

    it("defaults to disabled and reads only the current company flag", async () => {
      await expect(GetSettingService({ key, user: actor })).resolves.toBe(
        "disabled"
      );
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "101", companyId: 10 } })
      );
      expect(Setting.findAll).toHaveBeenCalledWith({
        where: { companyId: 10, key },
        attributes: ["value"],
        logging: false
      });
      expect(Setting.findOne).not.toHaveBeenCalled();
    });

    it.each([
      [[{ value: "enabled" }], "enabled"],
      [[{ value: "enabled" }, { value: "enabled" }], "enabled"],
      [[{ value: "enabled" }, { value: "disabled" }], "disabled"],
      [[{ value: "unknown" }], "disabled"]
    ])(
      "requires an unambiguous flag for the public status",
      async (rows, expected) => {
        (Setting.findAll as jest.Mock).mockResolvedValue(rows);
        await expect(GetSettingService({ key, user: actor })).resolves.toBe(
          expected
        );
      }
    );

    it("lets current staff read the safe flag without gaining a settings write", async () => {
      (User.findOne as jest.Mock).mockResolvedValue(current("user"));
      (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "enabled" }]);
      await expect(
        GetSettingService({
          key,
          user: { ...actor, profile: "user" }
        })
      ).resolves.toBe("enabled");
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await expect(
        update(req(key), response as unknown as Response)
      ).rejects.toMatchObject({
        message: "ERR_NO_PERMISSION",
        statusCode: 403
      });
      expect(UpdateSettingService).not.toHaveBeenCalled();
    });

    it.each([null, current("admin", 20)])(
      "refuses deleted or transferred actors before reading or changing another company's flag",
      async user => {
        (User.findOne as jest.Mock).mockResolvedValue(user);
        await expect(
          GetSettingService({ key, user: actor })
        ).rejects.toMatchObject({
          message: "ERR_NO_PERMISSION",
          statusCode: 403
        });
        await expect(update(req(key), {} as Response)).rejects.toMatchObject({
          message: "ERR_NO_PERMISSION",
          statusCode: 403
        });
        expect(Setting.findAll).not.toHaveBeenCalled();
        expect(UpdateSettingService).not.toHaveBeenCalled();
      }
    );

    it("does not accept a missing current identity for SCI status", async () => {
      await expect(
        GetSettingService({
          key,
          user: { profile: "admin", companyId: 10 }
        })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(Setting.findAll).not.toHaveBeenCalled();
    });

    it("uses only the authenticated company for the current administrator's write", async () => {
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await update(req(key), response as unknown as Response);
      expect(UpdateSettingService).toHaveBeenCalledWith({
        key,
        companyId: 10,
        value: "enabled"
      });
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("preserves the existing non-SCI setting read path", async () => {
      (Setting.findOne as jest.Mock).mockResolvedValue({ value: "enabled" });
      await expect(
        GetSettingService({ key: "acessoriasEnabled", user: actor })
      ).resolves.toBe("enabled");
      expect(User.findOne).not.toHaveBeenCalled();
      expect(Setting.findAll).not.toHaveBeenCalled();
      expect(Setting.findOne).toHaveBeenCalledWith({
        where: { companyId: 10, key: "acessoriasEnabled" }
      });
    });
  }
);
