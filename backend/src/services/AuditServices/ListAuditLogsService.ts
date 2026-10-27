import { Op, WhereOptions } from "sequelize";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import AppError from "../../errors/AppError";
import AuditLog from "../../models/AuditLog";
import User from "../../models/User";

// Zap Komunick: audit trail listing (docs/PRD.md, RF-016)

interface Request {
  companyId: number;
  pageNumber?: unknown;
  from?: unknown;
  to?: unknown;
  userId?: unknown;
  action?: unknown;
}

const PAGE_SIZE = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateOf = (value: unknown, edge: "start" | "end"): Date | null => {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !DATE.test(value) ||
    !isValid(parseISO(value))
  ) {
    throw new AppError("ERR_AUDIT_INVALID_DATE", 400);
  }
  return edge === "start"
    ? startOfDay(parseISO(value))
    : endOfDay(parseISO(value));
};

const ListAuditLogsService = async ({
  companyId,
  pageNumber,
  from,
  to,
  userId,
  action
}: Request) => {
  const page =
    pageNumber === undefined || pageNumber === "" ? 1 : Number(pageNumber);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(page * PAGE_SIZE)
  ) {
    throw new AppError("ERR_AUDIT_INVALID_FILTER", 400);
  }
  const where: WhereOptions = { companyId };
  const start = dateOf(from, "start");
  const end = dateOf(to, "end");
  if (start && end && start > end) {
    throw new AppError("ERR_AUDIT_INVALID_FILTER", 400);
  }
  if (start || end) {
    Object.assign(where, {
      createdAt: {
        ...(start ? { [Op.gte]: start } : {}),
        ...(end ? { [Op.lte]: end } : {})
      }
    });
  }
  if (userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError("ERR_AUDIT_INVALID_FILTER", 400);
    }
    Object.assign(where, { userId: id });
  }
  if (action) {
    // an action or a whole family, like "auth." or "user."
    const text = String(action);
    if (!/^[a-z0-9_.]+$/i.test(text)) {
      throw new AppError("ERR_AUDIT_INVALID_FILTER", 400);
    }
    Object.assign(where, {
      action: text.endsWith(".") ? { [Op.startsWith]: text } : text
    });
  }

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, attributes: ["id", "name", "email"] }],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });

  return {
    records: rows,
    count,
    hasMore: count > page * PAGE_SIZE
  };
};

export default ListAuditLogsService;
