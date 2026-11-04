import { Request, Response } from "express";
import { auditRequest } from "../services/AuditServices/RecordAuditService";
import { withCredentialAdmin } from "../services/CredentialServices/AuthorizeCredentialAdminService";
import {
  credentialStatus,
  deleteCredential,
  listCredentialStatus,
  migrateCredentials,
  saveCredential
} from "../services/CredentialServices/CredentialService";

const actorOf = (req: Request) => ({
  userId: req.user.id,
  companyId: req.user.companyId
});

export const index = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await withCredentialAdmin(actorOf(req), false, (companyId, transaction) =>
      listCredentialStatus(companyId, transaction)
    )
  );

export const show = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await withCredentialAdmin(actorOf(req), false, (companyId, transaction) =>
      credentialStatus(companyId, req.params.key, transaction)
    )
  );

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const status = await withCredentialAdmin(
    actorOf(req),
    true,
    (companyId, transaction) =>
      saveCredential(companyId, req.params.key, req.body?.value, transaction)
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
  const status = await withCredentialAdmin(
    actorOf(req),
    true,
    (companyId, transaction) =>
      deleteCredential(companyId, req.params.key, transaction)
  );
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
  const statuses = await withCredentialAdmin(
    actorOf(req),
    true,
    (companyId, transaction) => migrateCredentials(companyId, transaction)
  );
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
