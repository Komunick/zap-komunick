import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import { ticketContextError } from "../../helpers/TicketAccessRules";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import SlaAlert from "../../models/SlaAlert";
import Ticket from "../../models/Ticket";
import {
  ContextActor,
  loadTicketViewer
} from "../TicketServices/AuthorizeTicketContextService";

const ALERT_LIST_LIMIT = 50;

export const listSlaAlerts = (actor: ContextActor) =>
  SlaAlert.sequelize.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
      readOnly: true
    },
    async transaction => {
      const viewer = await loadTicketViewer(actor, transaction);
      const where = {
        companyId: actor.companyId,
        recipientId: Number(actor.userId)
      };
      const alerts = await SlaAlert.findAll({
        where,
        attributes: ["id", "ticketId", "readAt", "createdAt"],
        order: [
          ["readAt", "ASC NULLS FIRST"],
          ["createdAt", "DESC"],
          ["id", "DESC"]
        ],
        limit: ALERT_LIST_LIMIT,
        transaction
      });
      const unreadCount = await SlaAlert.count({
        where: { ...where, readAt: null },
        transaction
      });
      const tickets = alerts.length
        ? await Ticket.findAll({
            where: {
              id: { [Op.in]: alerts.map(alert => alert.ticketId) },
              companyId: actor.companyId
            },
            attributes: ["id", "uuid", "companyId", "queueId", "contactId"],
            include: [
              {
                model: Contact,
                as: "contact",
                attributes: ["companyId"],
                where: { companyId: actor.companyId },
                required: true
              },
              {
                model: Queue,
                as: "queue",
                attributes: ["name"],
                where: { companyId: actor.companyId },
                required: false
              }
            ],
            transaction
          })
        : [];
      const accessible = new Map(
        tickets
          .filter(
            ticket =>
              !ticketContextError(ticket, viewer, ticket.contact.companyId)
          )
          .map(ticket => [ticket.id, ticket])
      );
      return {
        unreadCount,
        alerts: alerts.map(alert => ({
          id: alert.id,
          createdAt: alert.createdAt,
          readAt: alert.readAt,
          ticketUuid: accessible.get(alert.ticketId)?.uuid ?? null,
          queueName: accessible.get(alert.ticketId)?.queue?.name ?? null
        }))
      };
    }
  );

export const markSlaAlertRead = async (actor: ContextActor, id: string) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    throw new AppError("ERR_SLA_ALERT_NOT_FOUND", 404);
  }
  await SlaAlert.sequelize.transaction(async transaction => {
    await loadTicketViewer(actor, transaction);
    const alert = await SlaAlert.findOne({
      where: {
        id: Number(id),
        companyId: actor.companyId,
        recipientId: Number(actor.userId)
      },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!alert) throw new AppError("ERR_SLA_ALERT_NOT_FOUND", 404);
    if (!alert.readAt)
      await alert.update({ readAt: new Date() }, { transaction });
  });
};
