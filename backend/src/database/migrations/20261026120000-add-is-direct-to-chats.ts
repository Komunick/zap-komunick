import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: internal chat with one-to-one conversations opened from the
// contact list (see docs/PRD.md, RF-010).
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Chats", "isDirect", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Chats", "isDirect");
  }
};
