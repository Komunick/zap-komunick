import UpdateSettingService from "../../services/SettingServices/UpdateSettingService";
import { safeSettingsKeys } from "../../services/SettingServices/GetSettingService";
import Setting from "../../models/Setting";

jest.mock("../../models/Setting", () => ({
  findOrCreate: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Queue", () => ({ findOne: jest.fn() }));
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));
jest.mock("../../services/TranslationServices/i18nService", () => ({
  updateDefaultLanguage: jest.fn()
}));

const KEY = "completionMessagePrompt";

beforeEach(() => jest.clearAllMocks());

// Anything that is not exactly "enabled" is read as "always send": a typo in
// the value would message every client the office finishes with.
it.each(["Enabled", "true", "ask", "", "enable", " enabled"])(
  "refuses the value %p for the question about the completion message",
  async value => {
    await expect(
      UpdateSettingService({ key: KEY, companyId: 10, value })
    ).rejects.toMatchObject({ message: "ERR_SYNTAX", statusCode: 400 });
    expect(Setting.findOrCreate).not.toHaveBeenCalled();
    expect(Setting.update).not.toHaveBeenCalled();
  }
);

it.each(["enabled", "disabled"])(
  "saves %s in every row the office has for the option",
  async value => {
    const row = {
      id: 1,
      companyId: 10,
      key: KEY,
      value: "disabled",
      update: jest.fn(),
      setDataValue: jest.fn()
    };
    (Setting.findOrCreate as jest.Mock).mockResolvedValue([row, false]);
    (Setting.update as jest.Mock).mockResolvedValue([2]);
    await UpdateSettingService({ key: KEY, companyId: 10, value });
    expect(row.update).toHaveBeenCalledWith({ value });
    // old databases may hold the same key twice: both rows end the same
    expect(Setting.update).toHaveBeenCalledWith(
      { value },
      { where: { companyId: 10, key: KEY } }
    );
  }
);

it("lets attendants read the option, with the old behaviour as the default", () => {
  expect(safeSettingsKeys).toHaveProperty(KEY, "disabled");
});
