import { Request } from "express";
import AuditLog from "../../models/AuditLog";
import { normalizeIp } from "../../helpers/IpAllowlist";
import { logger } from "../../utils/logger";

// Zap Komunick: audit trail (docs/PRD.md, RF-016). Recording never breaks the
// action being audited: a failure is only logged.

export interface AuditEntry {
  companyId?: number | null;
  userId?: number | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const requestIp = (req: Request): string =>
  normalizeIp(req.ip || req.socket?.remoteAddress || "");

const RecordAuditService = async (entry: AuditEntry): Promise<void> => {
  try {
    await AuditLog.create({
      companyId: entry.companyId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId:
        entry.entityId === undefined || entry.entityId === null
          ? null
          : String(entry.entityId),
      details: entry.details ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ? entry.userAgent.slice(0, 512) : null
    } as AuditLog);
  } catch (err) {
    logger.error({ err: err?.message, action: entry.action }, "audit failed");
  }
};

/** Audit an action of the signed-in user of this request. */
export const auditRequest = (
  req: Request,
  action: string,
  entity?: string | null,
  entityId?: string | number | null,
  details?: Record<string, unknown> | null
): Promise<void> =>
  RecordAuditService({
    companyId: req.user?.companyId ?? null,
    userId: req.user?.id ? Number(req.user.id) : null,
    action,
    entity,
    entityId,
    details,
    ip: requestIp(req),
    userAgent: String(req.headers["user-agent"] || "")
  });

export default RecordAuditService;
