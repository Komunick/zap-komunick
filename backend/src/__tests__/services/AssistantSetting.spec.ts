import UpdateSettingService from "../../services/SettingServices/UpdateSettingService";
import Setting from "../../models/Setting";

jest.mock("../../models/Setting", () => ({
  findOrCreate: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));
jest.mock("../../services/TranslationServices/i18nService", () => ({
  updateDefaultLanguage: jest.fn()
}));

const row = (id: number, companyId: number, key: string, value: string) => {
  const setting = {
    id,
    companyId,
    key,
    value,
    update: jest.fn(async change => {
      setting.value = change.value;
    }),
    setDataValue: jest.fn((_key: string, next: string) => {
      setting.value = next;
    })
  };
  return setting;
};

it.each(["enabled", "disabled"])(
  "converges duplicate assistant flags to %s and preserves another company",
  async value => {
    const rows = [
      row(1, 10, "aiAssistantEnabled", "enabled"),
      row(2, 10, "aiAssistantEnabled", "disabled"),
      row(3, 20, "aiAssistantEnabled", "disabled")
    ];
    (Setting.findOrCreate as jest.Mock).mockResolvedValue([rows[0], false]);
    (Setting.update as jest.Mock).mockImplementation(
      async (change, options) => {
        rows
          .filter(
            setting =>
              setting.companyId === options.where.companyId &&
              setting.key === options.where.key
          )
          .forEach(setting => {
            setting.value = change.value;
          });
        return [2];
      }
    );
    const result = await UpdateSettingService({
      key: "aiAssistantEnabled",
      companyId: 10,
      value
    });
    expect(rows.map(setting => setting.value)).toEqual([
      value,
      value,
      "disabled"
    ]);
    expect(result.value).toBe(value);
    expect(Setting.update).toHaveBeenLastCalledWith(
      { value },
      { where: { companyId: 10, key: "aiAssistantEnabled" } }
    );
  }
);

it("preserves other settings' existing single-row update behavior", async () => {
  const setting = row(1, 10, "soundGroupNotifications", "disabled");
  (Setting.findOrCreate as jest.Mock).mockResolvedValue([setting, false]);
  (Setting.update as jest.Mock).mockClear();
  await UpdateSettingService({
    key: "soundGroupNotifications",
    companyId: 10,
    value: "enabled"
  });
  expect(setting.update).toHaveBeenCalledWith({ value: "enabled" });
  expect(Setting.update).not.toHaveBeenCalled();
});

it("converges duplicate Acessórias flags without touching another office or AI", async () => {
  const rows = [
    row(1, 10, "acessoriasEnabled", "enabled"),
    row(2, 10, "acessoriasEnabled", "disabled"),
    row(3, 20, "acessoriasEnabled", "disabled"),
    row(4, 10, "aiAssistantEnabled", "disabled")
  ];
  (Setting.findOrCreate as jest.Mock).mockResolvedValue([rows[0], false]);
  (Setting.update as jest.Mock).mockImplementation(async (change, options) => {
    rows
      .filter(
        setting =>
          setting.companyId === options.where.companyId &&
          setting.key === options.where.key
      )
      .forEach(setting => {
        setting.value = change.value;
      });
  });
  await UpdateSettingService({
    key: "acessoriasEnabled",
    companyId: 10,
    value: "enabled"
  });
  expect(rows.map(setting => setting.value)).toEqual([
    "enabled",
    "enabled",
    "disabled",
    "disabled"
  ]);
});

it("refuses unknown Acessórias flag values before persistence", async () => {
  (Setting.findOrCreate as jest.Mock).mockClear();
  await expect(
    UpdateSettingService({
      key: "acessoriasEnabled",
      companyId: 10,
      value: "real"
    })
  ).rejects.toMatchObject({
    message: "ERR_ACESSORIAS_INVALID_REQUEST",
    statusCode: 400
  });
  expect(Setting.findOrCreate).not.toHaveBeenCalled();
});
