import { Request, Response } from "express";

import SlaPanelService from "../services/SlaServices/SlaPanelService";

export const panel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const result = await SlaPanelService(companyId);
  return res.status(200).json(result);
};
