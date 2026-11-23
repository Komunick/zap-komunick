import { Request, Response } from "express";

import SlaPanelService from "../services/SlaServices/SlaPanelService";
import {
  getSlaAlertConfig,
  updateSlaAlertConfig
} from "../services/SlaServices/SlaAlertConfigurationService";
import {
  listSlaAlerts,
  markSlaAlertRead
} from "../services/SlaServices/SlaInboxService";
import { auditRequest } from "../services/AuditServices/RecordAuditService";

export const panel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const result = await SlaPanelService(companyId);
  return res.status(200).json(result);
};

export const alertConfig = async (
  req: Request,
  res: Response
): Promise<Response> => res.json(await getSlaAlertConfig(req.user.companyId));

export const updateAlertConfig = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id, companyId } = req.user;
  const config = await updateSlaAlertConfig(companyId, id, req.body);
  await auditRequest(req, "sla.alert_config_updated", "setting", null, {
    enabled: config.enabled
  });
  return res.json(config);
};

export const alerts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  res.set("Cache-Control", "private, no-store");
  const { companyId, id: userId } = req.user;
  return res.json(await listSlaAlerts({ companyId, userId }));
};

export const readAlert = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  await markSlaAlertRead({ companyId, userId }, req.params.alertId);
  return res.status(204).end();
};
