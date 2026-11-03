import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "ContactExternalClientLinks",
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          companyId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Companies", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          contactId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Contacts", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          provider: { type: DataTypes.STRING(32), allowNull: false },
          externalClientId: { type: DataTypes.STRING(64), allowNull: false },
          createdAt: { type: DataTypes.DATE, allowNull: false },
          updatedAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.addConstraint("ContactExternalClientLinks", {
        fields: ["companyId", "contactId", "provider", "externalClientId"],
        type: "unique",
        name: "contact_external_client_links_scope_unique",
        transaction
      });
    }),
  down: async () => {
    throw new Error(
      "Preserve ContactExternalClientLinks when reverting application code; use forward recovery"
    );
  }
};
