import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: attachment and business days for scheduled messages
// (docs/PRD.md, RF-008)
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Schedules",
        "mediaPath",
        { type: DataTypes.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "Schedules",
        "mediaName",
        { type: DataTypes.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "Schedules",
        "businessDaysOnly",
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("Schedules", "businessDaysOnly", {
        transaction
      });
      await queryInterface.removeColumn("Schedules", "mediaName", {
        transaction
      });
      await queryInterface.removeColumn("Schedules", "mediaPath", {
        transaction
      });
    });
  }
};
