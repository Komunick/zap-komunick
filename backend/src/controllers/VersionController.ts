import { Request, Response } from "express";
import GetPublicSettingService from "../services/SettingServices/GetPublicSettingService";
import { GitInfo } from "../gitinfo";
import { resolveProductName } from "../helpers/ProductBrand";

export const version = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const appName = resolveProductName(
    await GetPublicSettingService({ key: "appName" })
  );

  const data = {
    name: appName,
    ...GitInfo
  };

  return res.status(200).json(data);
};
