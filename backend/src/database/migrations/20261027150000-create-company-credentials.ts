import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: schema only. Plaintext migration requires an explicit admin action.
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyCredentials", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      key: { type: DataTypes.STRING, allowNull: false },
      encryptedValue: { type: DataTypes.TEXT, allowNull: false },
      keyId: { type: DataTypes.STRING, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addConstraint("CompanyCredentials", {
      fields: ["companyId", "key"],
      type: "unique",
      name: "company_credentials_company_key_unique"
    });
  },

  down: async () => {
    // Dropping this table after migration would destroy the only credential copy.
    throw new Error(
      "CompanyCredentials requires forward recovery; preserve the table and master key"
    );
  }
};
