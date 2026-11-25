import { DataTypes, QueryInterface } from "sequelize";

// Error reports sent by the users during the beta (docs/PRD.md, RF-030).
// The report outlives the user and the company: both links become NULL when
// either is deleted, and the copied names keep the mail readable.
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("ErrorReports", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyName: { type: DataTypes.STRING, allowNull: true },
      userName: { type: DataTypes.STRING, allowNull: true },
      userEmail: { type: DataTypes.STRING, allowNull: true },
      userProfile: { type: DataTypes.STRING, allowNull: true },
      title: { type: DataTypes.STRING, allowNull: false },
      location: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      screen: { type: DataTypes.STRING, allowNull: true },
      appUrl: { type: DataTypes.STRING, allowNull: true },
      attachments: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      emailStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      emailAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emailError: { type: DataTypes.TEXT, allowNull: true },
      emailAttemptedAt: { type: DataTypes.DATE, allowNull: true },
      emailSentAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("ErrorReports", ["emailStatus", "id"], {
      name: "error_reports_email_status_id"
    });
    await queryInterface.addIndex("ErrorReports", ["userId", "createdAt"], {
      name: "error_reports_user_created_at"
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("ErrorReports");
  }
};
