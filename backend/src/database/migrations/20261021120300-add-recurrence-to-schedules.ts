import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: recurring scheduled messages (see docs/PRD.md, RF-006).
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Schedules",
        "recurrence",
        {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "none"
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "Schedules",
        "recurrenceEndAt",
        {
          type: DataTypes.DATE,
          allowNull: true
        },
        { transaction }
      );
      // first occurrence of the series, used to compute the next ones without
      // drifting (e.g. monthly on the 31st)
      await queryInterface.addColumn(
        "Schedules",
        "recurrenceAnchorAt",
        {
          type: DataTypes.DATE,
          allowNull: true
        },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("Schedules", "recurrenceAnchorAt", {
        transaction
      });
      await queryInterface.removeColumn("Schedules", "recurrenceEndAt", {
        transaction
      });
      await queryInterface.removeColumn("Schedules", "recurrence", {
        transaction
      });
    });
  }
};
