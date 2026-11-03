import { QueryTypes } from "sequelize";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import sequelize from "../../database";
import Queue from "../../models/Queue";
import User from "../../models/User";
import CloseReason from "../../models/CloseReason";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import {
  buildHeatmap,
  fillDays,
  MetricsParams,
  percent,
  seconds
} from "../../helpers/Metrics";

// Zap Komunick: metrics panel (docs/PRD.md, RF-015). One service cycle of a
// ticket is one row of TicketTraking (accept, pause/resume and close open and
// end cycles); group conversations are left out.

const TZ = process.env.TZ || "America/Sao_Paulo";

type Row = Record<string, unknown>;

const MetricsService = async (companyId: number, params: MetricsParams) => {
  const start = startOfDay(parseISO(params.from));
  const end = endOfDay(parseISO(params.to));
  const slaMinutes =
    Number(await GetCompanySetting(companyId, "slaMinutes", "0")) || 0;

  const replacements = {
    companyId,
    start,
    end,
    tz: TZ,
    queueId: params.queueId,
    userId: params.userId,
    slaSeconds: slaMinutes * 60
  };

  const filters = [
    params.queueId ? `AND t."queueId" = :queueId` : "",
    params.userId ? `AND tt."userId" = :userId` : ""
  ].join(" ");

  const base = `
    FROM "TicketTraking" tt
    JOIN "Tickets" t ON t.id = tt."ticketId"
    WHERE tt."companyId" = :companyId
      AND t."isGroup" = false
      ${filters}`;

  const inPeriod = (column: string) => `tt."${column}" BETWEEN :start AND :end`;
  const touched = `AND (${inPeriod("createdAt")} OR ${inPeriod(
    "startedAt"
  )} OR ${inPeriod("finishedAt")})`;

  const aggregates = `
    COUNT(*) FILTER (WHERE ${inPeriod("createdAt")}) AS created,
    COUNT(*) FILTER (WHERE ${inPeriod("finishedAt")}) AS finished,
    AVG(tt."waitTime") FILTER (WHERE ${inPeriod("startedAt")}) AS "avgWait",
    AVG(tt."serviceTime") FILTER (WHERE ${inPeriod(
      "finishedAt"
    )}) AS "avgService",
    COUNT(*) FILTER (WHERE ${inPeriod(
      "startedAt"
    )} AND tt."waitTime" IS NOT NULL) AS answered,
    COUNT(*) FILTER (WHERE ${inPeriod(
      "startedAt"
    )} AND tt."waitTime" <= :slaSeconds) AS "answeredInTime"`;

  const select = (sql: string) =>
    sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT
    }) as Promise<Row[]>;

  const ratingFilters = [
    params.queueId ? `AND t."queueId" = :queueId` : "",
    params.userId ? `AND ur."userId" = :userId` : ""
  ].join(" ");

  const [
    [totals],
    days,
    queues,
    users,
    reasons,
    heat,
    [contacts],
    [rating],
    ratingByUser
  ] = await Promise.all([
    select(`SELECT ${aggregates} ${base} ${touched}`),
    select(`
      SELECT day, SUM(created) AS created, SUM(finished) AS finished FROM (
        SELECT to_char(tt."createdAt" AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
               1 AS created, 0 AS finished
        ${base} AND ${inPeriod("createdAt")}
        UNION ALL
        SELECT to_char(tt."finishedAt" AT TIME ZONE :tz, 'YYYY-MM-DD') AS day,
               0 AS created, 1 AS finished
        ${base} AND ${inPeriod("finishedAt")}
      ) d GROUP BY day`),
    select(`SELECT t."queueId", ${aggregates} ${base} ${touched}
            GROUP BY t."queueId"`),
    select(`SELECT tt."userId", ${aggregates} ${base} ${touched}
            GROUP BY tt."userId"`),
    select(`SELECT tt."closeReasonId", COUNT(*) AS count
            ${base} AND ${inPeriod("finishedAt")}
            GROUP BY tt."closeReasonId"`),
    select(`SELECT EXTRACT(DOW FROM tt."createdAt" AT TIME ZONE :tz) AS weekday,
                   EXTRACT(HOUR FROM tt."createdAt" AT TIME ZONE :tz) AS hour,
                   COUNT(*) AS count
            ${base} AND ${inPeriod("createdAt")}
            GROUP BY 1, 2`),
    select(`SELECT COUNT(*) AS count FROM "Contacts"
            WHERE "companyId" = :companyId AND "isGroup" = false
              AND "createdAt" BETWEEN :start AND :end`),
    select(`SELECT AVG(ur.rate) AS avg, COUNT(*) AS count
            FROM "UserRatings" ur JOIN "Tickets" t ON t.id = ur."ticketId"
            WHERE ur."companyId" = :companyId
              AND ur."createdAt" BETWEEN :start AND :end ${ratingFilters}`),
    select(`SELECT ur."userId", AVG(ur.rate) AS avg, COUNT(*) AS count
            FROM "UserRatings" ur JOIN "Tickets" t ON t.id = ur."ticketId"
            WHERE ur."companyId" = :companyId
              AND ur."createdAt" BETWEEN :start AND :end ${ratingFilters}
            GROUP BY ur."userId"`)
  ]);

  const [queueList, userList, reasonList] = await Promise.all([
    Queue.findAll({
      where: { companyId },
      attributes: ["id", "name", "color"]
    }),
    User.findAll({ where: { companyId }, attributes: ["id", "name"] }),
    CloseReason.findAll({ where: { companyId }, attributes: ["id", "name"] })
  ]);
  const queueById = new Map(queueList.map(q => [q.id, q]));
  const userById = new Map(userList.map(u => [u.id, u]));
  const reasonById = new Map(reasonList.map(r => [r.id, r]));
  const ratingOf = new Map(ratingByUser.map(r => [Number(r.userId), r]));

  const shape = (row: Row) => ({
    created: Number(row.created) || 0,
    finished: Number(row.finished) || 0,
    avgWait: seconds(row.avgWait),
    avgService: seconds(row.avgService),
    slaPercent:
      slaMinutes > 0
        ? percent(Number(row.answeredInTime) || 0, Number(row.answered) || 0)
        : null
  });

  const finishedTotal = reasons.reduce((sum, r) => sum + Number(r.count), 0);

  return {
    period: { from: params.from, to: params.to, days: params.days },
    slaMinutes,
    totals: {
      ...shape(totals || {}),
      newContacts: Number(contacts?.count) || 0,
      rating: Number(rating?.count)
        ? Math.round(Number(rating.avg) * 10) / 10
        : null,
      ratings: Number(rating?.count) || 0
    },
    byDay: fillDays(params.from, params.days, days as never),
    byQueue: queues
      .map(row => {
        const queue = queueById.get(Number(row.queueId));
        return {
          queueId: row.queueId ? Number(row.queueId) : null,
          name: queue?.name || null,
          color: queue?.color || null,
          ...shape(row)
        };
      })
      .sort((a, b) => b.created - a.created),
    byUser: users
      .map(row => {
        const id = row.userId ? Number(row.userId) : null;
        const userRating = id ? ratingOf.get(id) : null;
        return {
          userId: id,
          name: id ? userById.get(id)?.name || null : null,
          ...shape(row),
          rating: userRating
            ? Math.round(Number(userRating.avg) * 10) / 10
            : null
        };
      })
      .sort((a, b) => b.finished - a.finished),
    closeReasons: reasons
      .map(row => {
        const id = row.closeReasonId ? Number(row.closeReasonId) : null;
        return {
          closeReasonId: id,
          name: id ? reasonById.get(id)?.name || null : null,
          count: Number(row.count) || 0,
          percent: percent(Number(row.count) || 0, finishedTotal)
        };
      })
      .sort((a, b) => b.count - a.count),
    heatmap: buildHeatmap(heat as never)
  };
};

export default MetricsService;
