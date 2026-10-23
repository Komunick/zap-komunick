import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: reasons chosen when a ticket is closed (docs/PRD.md, RF-007)
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "CloseReasons",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false
          },
          active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          companyId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Companies", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          createdAt: { type: DataTypes.DATE, allowNull: false },
          updatedAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );

      await queryInterface.addIndex("CloseReasons", ["companyId"], {
        name: "idx_closereasons_companyid",
        transaction
      });

      await queryInterface.addColumn(
        "TicketTraking",
        "closeReasonId",
        {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "CloseReasons", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "TicketTraking",
        "closeReasonNote",
        {
          type: DataTypes.TEXT,
          allowNull: true
        },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("TicketTraking", "closeReasonNote", {
        transaction
      });
      await queryInterface.removeColumn("TicketTraking", "closeReasonId", {
        transaction
      });
      await queryInterface.dropTable("CloseReasons", { transaction });
    });
  }
};
