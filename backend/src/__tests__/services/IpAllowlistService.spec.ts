import {
  getAllowlist,
  saveAllowlist
} from "../../services/SecurityServices/IpAllowlistService";
import Setting from "../../models/Setting";
import Company from "../../models/Company";

jest.mock("../../models/Setting", () => ({
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
  sequelize: { transaction: jest.fn() }
}));
jest.mock("../../models/Company", () => ({ findByPk: jest.fn() }));

describe("company IP allowlist", () => {
  const request = {
    companyId: 7,
    enabled: true,
    text: "10.0.0.0/8",
    currentIp: "10.1.2.3",
    isSuper: false
  };
  const update = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (Setting.sequelize.transaction as jest.Mock).mockImplementation(
      async callback => callback({ LOCK: { UPDATE: "UPDATE" } })
    );
    (Setting.findOrCreate as jest.Mock).mockResolvedValue([{ update }]);
  });

  it.each([
    ["not-an-ip", "ERR_IP_ALLOWLIST_INVALID"],
    ["", "ERR_IP_ALLOWLIST_EMPTY"],
    ["192.0.2.1", "ERR_IP_ALLOWLIST_LOCKOUT"]
  ])("rejects %s before persisting any setting", async (text, error) => {
    await expect(saveAllowlist({ ...request, text })).rejects.toMatchObject({
      message: error
    });
    expect(Setting.findOrCreate).not.toHaveBeenCalled();
  });

  it("rejects more than 100 distinct entries", async () => {
    const text = Array.from({ length: 101 }, (_, i) => `10.0.0.${i}`).join(
      "\n"
    );
    await expect(saveAllowlist({ ...request, text })).rejects.toMatchObject({
      message: "ERR_IP_ALLOWLIST_TOO_MANY"
    });
  });

  it("allows disabling restrictions and scopes both writes to the company", async () => {
    await expect(
      saveAllowlist({ ...request, enabled: false, text: "" })
    ).resolves.toMatchObject({ enabled: false, entries: [] });
    expect(Company.findByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ lock: "UPDATE" })
    );
    expect(Setting.findOrCreate).toHaveBeenCalledTimes(2);
    (Setting.findOrCreate as jest.Mock).mock.calls.forEach(([options]) =>
      expect(options.where.companyId).toBe(7)
    );
  });

  it("preserves the documented super-user lockout exemption", async () => {
    await expect(
      saveAllowlist({ ...request, text: "192.0.2.1", isSuper: true })
    ).resolves.toMatchObject({ enabled: true, entries: ["192.0.2.1"] });
  });

  it("reads the enable flag and addresses from the same company snapshot", async () => {
    (Setting.findAll as jest.Mock).mockResolvedValue([
      { key: "ipAllowlistEnabled", value: "enabled" },
      { key: "ipAllowlist", value: "10.0.0.0/8" }
    ]);
    await expect(getAllowlist(7)).resolves.toEqual({
      enabled: true,
      text: "10.0.0.0/8",
      entries: ["10.0.0.0/8"]
    });
    expect(Setting.findAll).toHaveBeenCalledWith({
      where: { companyId: 7, key: ["ipAllowlistEnabled", "ipAllowlist"] }
    });
  });
});
