import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: client wallet, the user responsible for the contact
// (see docs/PRD.md, RF-003).
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Contacts",
        "walletUserId",
        {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        { transaction }
      );

      await queryInterface.addIndex("Contacts", ["companyId", "walletUserId"], {
        name: "idx_contacts_companyid_walletuserid",
        transaction
      });
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeIndex(
        "Contacts",
        "idx_contacts_companyid_walletuserid",
        { transaction }
      );
      await queryInterface.removeColumn("Contacts", "walletUserId", {
        transaction
      });
    });
  }
};
