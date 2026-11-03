import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: SLA panel. Marks since when the client has been waiting for a
// human reply on the ticket (see docs/PRD.md, RF-002).
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Tickets",
        "unansweredSince",
        {
          type: DataTypes.DATE,
          allowNull: true
        },
        { transaction }
      );

      // best effort backfill for tickets that are already in service: first
      // client message after the last message sent by the company
      await queryInterface.sequelize.query(
        `UPDATE "Tickets" t SET "unansweredSince" = sub.since
         FROM (
           SELECT t2.id, (
             SELECT MIN(m."createdAt") FROM "Messages" m
             WHERE m."ticketId" = t2.id
               AND m."fromMe" = false
               AND m."createdAt" > COALESCE(
                 (SELECT MAX(m2."createdAt") FROM "Messages" m2
                  WHERE m2."ticketId" = t2.id AND m2."fromMe" = true),
                 '1970-01-01'::timestamptz
               )
           ) AS since
           FROM "Tickets" t2
           WHERE t2.status IN ('open', 'pending')
         ) sub
         WHERE t.id = sub.id AND sub.since IS NOT NULL`,
        { transaction }
      );

      await queryInterface.addIndex(
        "Tickets",
        ["companyId", "status", "unansweredSince"],
        {
          name: "idx_tickets_companyid_status_unansweredsince",
          transaction
        }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeIndex(
        "Tickets",
        "idx_tickets_companyid_status_unansweredsince",
        { transaction }
      );
      await queryInterface.removeColumn("Tickets", "unansweredSince", {
        transaction
      });
    });
  }
};
