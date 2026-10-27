import { Request, Response } from "express";
import { auditRequest } from "../services/AuditServices/RecordAuditService";
import {
  credentialStatus,
  deleteCredential,
  listCredentialStatus,
  migrateCredentials,
  saveCredential
} from "../services/CredentialServices/CredentialService";

export const index = async (req: Request, res: Response): Promise<Response> =>
  res.json(await listCredentialStatus(req.user.companyId));

export const show = async (req: Request, res: Response): Promise<Response> =>
  res.json(await credentialStatus(req.user.companyId, req.params.key));

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const status = await saveCredential(
    req.user.companyId,
    req.params.key,
    req.body?.value
  );
  await auditRequest(
    req,
    "security.credential_updated",
    "credential",
    status.key,
    {
      configured: status.configured
    }
  );
  return res.json(status);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const status = await deleteCredential(req.user.companyId, req.params.key);
  await auditRequest(
    req,
    "security.credential_deleted",
    "credential",
    status.key,
    {
      configured: status.configured
    }
  );
  return res.json(status);
};

export const migrate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const statuses = await migrateCredentials(req.user.companyId);
  await auditRequest(
    req,
    "security.credentials_migrated",
    "company",
    req.user.companyId,
    {
      keys: statuses
        .filter(status => status.configured)
        .map(status => status.key)
    }
  );
  return res.json(statuses);
};
