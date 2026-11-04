import { Request, Response } from "express";
import {
  CloseReasonReportService,
  CreateCloseReasonService,
  DeleteCloseReasonService,
  ListCloseReasonsService,
  UpdateCloseReasonService
} from "../services/CloseReasonServices/CloseReasonService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile } = req.user;
  const includeInactive = req.query.all === "true" && profile === "admin";
  const reasons = await ListCloseReasonsService(companyId, includeInactive);
  return res.status(200).json(reasons);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const reason = await CreateCloseReasonService(req.user.companyId, req.body);
  return res.status(200).json(reason);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const reason = await UpdateCloseReasonService(
    req.params.closeReasonId,
    req.user.companyId,
    req.body
  );
  return res.status(200).json(reason);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await DeleteCloseReasonService(req.params.closeReasonId, req.user.companyId);
  return res.status(200).json({ message: "Close reason deleted" });
};

export const report = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const days = Number(req.query.days) || 30;
  const result = await CloseReasonReportService(req.user.companyId, days);
  return res.status(200).json(result);
};
