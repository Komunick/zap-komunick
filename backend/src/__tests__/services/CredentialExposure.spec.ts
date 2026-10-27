import ListSettingsService from "../../services/SettingServices/ListSettingsService";
import { SerializeUser } from "../../helpers/SerializeUser";
import Setting from "../../models/Setting";
import User from "../../models/User";

jest.mock("../../models/Setting", () => ({ findAll: jest.fn() }));
jest.mock("../../models/User", () => ({}));
jest.mock("../../models/Company", () => ({}));

const privateValue = "fixture-private-value-never-a-real-credential";
const settings = [
  { key: "openAiKey", value: privateValue, companyId: 7 },
  { key: "campaignsEnabled", value: "enabled", companyId: 7 }
];

describe("credentials never leave general settings or authentication", () => {
  it("masks legacy credential values in the administrative settings list", async () => {
    (Setting.findAll as jest.Mock).mockResolvedValue(settings);
    const result = await ListSettingsService({ isSuper: true, companyId: 7 });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "campaignsEnabled", value: "enabled" })
      ])
    );
  });

  it("omits private settings from the user company while preserving public configuration", async () => {
    const companySettings = [
      ...settings,
      { key: "apiToken", value: privateValue },
      { key: "_efiClientSecret", value: privateValue }
    ];
    const result = await SerializeUser({
      id: 1,
      companyId: 7,
      company: { id: 7, settings: companySettings }
    } as unknown as User);
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.company.settings).toEqual([
      expect.objectContaining({ key: "campaignsEnabled", value: "enabled" })
    ]);
  });
});
