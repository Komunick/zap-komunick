import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: weekdays and time range in which the user may access the
// system. Null means no restriction (see docs/PRD.md, RF-005).
export default {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "accessHours", {
      type: DataTypes.JSONB,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "accessHours");
  }
};
