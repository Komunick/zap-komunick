import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: tags per sector (docs/PRD.md, RF-019). null = every sector.
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tags", "queueIds", {
      type: DataTypes.JSONB,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tags", "queueIds");
  }
};
