import { DataTypes, Op, QueryInterface } from "sequelize";

const index = "tickets_pending_general_triage";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Tickets",
        "generalTriageStartedAt",
        { type: DataTypes.DATE, allowNull: true },
        { transaction }
      );
      await queryInterface.addIndex(
        "Tickets",
        ["companyId", "generalTriageStartedAt"],
        {
          name: index,
          where: {
            status: "pending",
            channel: "whatsapp",
            isGroup: false,
            queueId: null,
            userId: null,
            generalTriageStartedAt: { [Op.ne]: null }
          },
          transaction
        }
      );
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeIndex("Tickets", index, { transaction });
      await queryInterface.removeColumn("Tickets", "generalTriageStartedAt", {
        transaction
      });
    });
  }
};
