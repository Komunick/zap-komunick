import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: audit trail of security and administration events
// (docs/PRD.md, RF-016)
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "AuditLogs",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          companyId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Companies", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
          },
          action: { type: DataTypes.STRING, allowNull: false },
          entity: { type: DataTypes.STRING, allowNull: true },
          entityId: { type: DataTypes.STRING, allowNull: true },
          details: { type: DataTypes.JSONB, allowNull: true },
          ip: { type: DataTypes.STRING, allowNull: true },
          userAgent: { type: DataTypes.STRING(512), allowNull: true },
          createdAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.addIndex("AuditLogs", ["companyId", "createdAt"], {
        name: "idx_auditlogs_company_created",
        transaction
      });
      await queryInterface.addIndex("AuditLogs", ["companyId", "action"], {
        name: "idx_auditlogs_company_action",
        transaction
      });
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AuditLogs");
  }
};
