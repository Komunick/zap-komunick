import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "SlaAlertConfigurations",
        {
          companyId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: "Companies", key: "id" },
            onDelete: "CASCADE"
          },
          enabled: { type: DataTypes.BOOLEAN, allowNull: false },
          extraRecipientIds: { type: DataTypes.JSONB, allowNull: false },
          queues: { type: DataTypes.JSONB, allowNull: false },
          createdAt: { type: DataTypes.DATE, allowNull: false },
          updatedAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.createTable(
        "SlaAlerts",
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
            onDelete: "CASCADE"
          },
          ticketId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Tickets", key: "id" },
            onDelete: "CASCADE"
          },
          recipientId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onDelete: "CASCADE"
          },
          unansweredSince: { type: DataTypes.DATE, allowNull: false },
          readAt: { type: DataTypes.DATE, allowNull: true },
          createdAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.addIndex(
        "SlaAlerts",
        ["ticketId", "recipientId", "unansweredSince"],
        { unique: true, name: "sla_alert_wait_recipient_unique", transaction }
      );
      await queryInterface.addIndex(
        "SlaAlerts",
        ["companyId", "recipientId", "createdAt"],
        { name: "sla_alert_company_recipient_created_idx", transaction }
      );
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable("SlaAlerts", { transaction });
      await queryInterface.dropTable("SlaAlertConfigurations", { transaction });
    });
  }
};
