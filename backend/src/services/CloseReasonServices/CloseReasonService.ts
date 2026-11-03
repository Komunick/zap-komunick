import { Op, QueryTypes } from "sequelize";
import { subDays } from "date-fns";
import AppError from "../../errors/AppError";
import CloseReason from "../../models/CloseReason";
import sequelize from "../../database";

// Zap Komunick: reasons chosen when a ticket is closed (docs/PRD.md, RF-007)

const normalizeName = (name: unknown): string => {
  const value = typeof name === "string" ? name.trim() : "";
  if (value.length < 2 || value.length > 120) {
    throw new AppError("ERR_CLOSE_REASON_INVALID_NAME", 400);
  }
  return value;
};

const findOwned = async (id: number | string, companyId: number) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new AppError("ERR_CLOSE_REASON_NOT_FOUND", 404);
  }
  const reason = await CloseReason.findOne({
    where: { id: Number(id), companyId }
  });
  if (!reason) {
    throw new AppError("ERR_CLOSE_REASON_NOT_FOUND", 404);
  }
  return reason;
};

export const ListCloseReasonsService = (
  companyId: number,
  includeInactive = false
) =>
  CloseReason.findAll({
    where: { companyId, ...(includeInactive ? {} : { active: true }) },
    order: [["name", "ASC"]]
  });

export const ActiveCloseReasonIds = async (companyId: number) =>
  (
    await CloseReason.findAll({
      where: { companyId, active: true },
      attributes: ["id"]
    })
  ).map(reason => reason.id);

export const CreateCloseReasonService = async (
  companyId: number,
  data: { name: unknown; active?: unknown }
) => {
  const name = normalizeName(data.name);
  const duplicated = await CloseReason.findOne({
    where: { companyId, name: { [Op.iLike]: name } }
  });
  if (duplicated) {
    throw new AppError("ERR_CLOSE_REASON_DUPLICATED", 400);
  }
  return CloseReason.create({
    companyId,
    name,
    active: data.active === undefined ? true : !!data.active
  });
};

export const UpdateCloseReasonService = async (
  id: number | string,
  companyId: number,
  data: { name?: unknown; active?: unknown }
) => {
  const reason = await findOwned(id, companyId);
  const changes: Partial<CloseReason> = {};
  if (data.name !== undefined) {
    changes.name = normalizeName(data.name);
  }
  if (data.active !== undefined) {
    changes.active = !!data.active;
  }
  await reason.update(changes);
  return reason;
};

export const DeleteCloseReasonService = async (
  id: number | string,
  companyId: number
) => {
  const reason = await findOwned(id, companyId);
  await reason.destroy();
};

/**
 * How many service cycles were closed with each reason in the last days.
 * Cycles closed without a reason come with closeReasonId null.
 */
export const CloseReasonReportService = async (
  companyId: number,
  days = 30
) => {
  const since = subDays(new Date(), Math.max(1, Math.min(days, 366)));
  const rows = (await sequelize.query(
    `SELECT tt."closeReasonId" AS "closeReasonId", cr.name AS name, COUNT(*)::int AS count
       FROM "TicketTraking" tt
       LEFT JOIN "CloseReasons" cr ON cr.id = tt."closeReasonId"
      WHERE tt."companyId" = :companyId
        AND tt."finishedAt" >= :since
      GROUP BY tt."closeReasonId", cr.name
      ORDER BY count DESC`,
    { replacements: { companyId, since }, type: QueryTypes.SELECT }
  )) as Array<{ closeReasonId: number | null; name: string; count: number }>;
  return { since: since.toISOString(), rows };
};
