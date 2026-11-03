import Setting from "../../models/Setting";
import { resolveProductName } from "../../helpers/ProductBrand";

interface Request {
  key: string;
}

const publicSettingsKeys = [
  "allowSignup",
  "primaryColorLight",
  "primaryColorDark",
  "appLogoLight",
  "appLogoDark",
  "appLogoFavicon",
  "appName",
  "loginPageLinks",
  "loginSidePanelImage",
  "loginBackgroundContent",
  "vapidPublicKey",
  "extensionDownloadUrl"
];

const GetPublicSettingService = async ({
  key
}: Request): Promise<string | undefined> => {
  if (!publicSettingsKeys.includes(key)) {
    return null;
  }

  const setting = await Setting.findOne({
    where: {
      companyId: 1,
      key
    }
  });

  return key === "appName"
    ? resolveProductName(setting?.value)
    : setting?.value || null;
};

export default GetPublicSettingService;
