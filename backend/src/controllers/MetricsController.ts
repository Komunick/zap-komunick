import { Request, Response } from "express";

import AppError from "../errors/AppError";
import { parseMetricsQuery } from "../helpers/Metrics";
import MetricsService from "../services/ReportService/MetricsService";

// Zap Komunick: metrics panel (docs/PRD.md, RF-015)
export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { params, error } = parseMetricsQuery(req.query);
  if (error) {
    throw new AppError(error, 400);
  }

  return res.status(200).json(await MetricsService(companyId, params));
};
