import { DataTypes, Op, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Schedules",
        "queueId",
        {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Queues", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "Schedules",
        "routingMode",
        { type: DataTypes.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.bulkUpdate(
        "Schedules",
        { routingMode: "ticket" },
        { ticketId: { [Op.ne]: null } },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("Schedules", "routingMode", {
        transaction
      });
      await queryInterface.removeColumn("Schedules", "queueId", {
        transaction
      });
    });
  }
};
