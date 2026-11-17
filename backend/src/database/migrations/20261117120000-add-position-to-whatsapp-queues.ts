import { DataTypes, QueryInterface } from "sequelize";

// Order of the queues in the bot menu of each channel. The existing links get
// the alphabetical order used until now, so the menu does not change for
// anyone who never reorders the queues.
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "WhatsappQueues",
        "position",
        { type: DataTypes.INTEGER, allowNull: true },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE "WhatsappQueues" AS wq
            SET "position" = ranked."position"
           FROM (
             SELECT w."whatsappId",
                    w."queueId",
                    ROW_NUMBER() OVER (
                      PARTITION BY w."whatsappId"
                      ORDER BY q."name" ASC, q."id" ASC
                    ) AS "position"
               FROM "WhatsappQueues" AS w
               JOIN "Queues" AS q ON q."id" = w."queueId"
           ) AS ranked
          WHERE wq."whatsappId" = ranked."whatsappId"
            AND wq."queueId" = ranked."queueId"`,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("WhatsappQueues", "position");
  }
};
