import { DataTypes, QueryInterface } from "sequelize";

// Support tickets with a conversation (docs/PRD.md, RF-030). They replace the
// error reports sent by mail: each stored report becomes a ticket whose first
// message is the report, and the old table goes away.
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "SupportTickets",
        {
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
          category: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "other"
          },
          priority: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "medium"
          },
          status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "open"
          },
          location: { type: DataTypes.STRING, allowNull: true },
          userAgent: { type: DataTypes.TEXT, allowNull: true },
          screen: { type: DataTypes.STRING, allowNull: true },
          appUrl: { type: DataTypes.STRING, allowNull: true },
          assignedUserId: {
            type: DataTypes.INTEGER,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
            allowNull: true
          },
          assignedUserName: { type: DataTypes.STRING, allowNull: true },
          lastMessageAt: { type: DataTypes.DATE, allowNull: true },
          lastRequesterMessageAt: { type: DataTypes.DATE, allowNull: true },
          lastSupportMessageAt: { type: DataTypes.DATE, allowNull: true },
          requesterReadAt: { type: DataTypes.DATE, allowNull: true },
          supportReadAt: { type: DataTypes.DATE, allowNull: true },
          finishedAt: { type: DataTypes.DATE, allowNull: true },
          createdAt: { type: DataTypes.DATE, allowNull: false },
          updatedAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.createTable(
        "SupportMessages",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          ticketId: {
            type: DataTypes.INTEGER,
            references: { model: "SupportTickets", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
            allowNull: false
          },
          userId: {
            type: DataTypes.INTEGER,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
            allowNull: true
          },
          userName: { type: DataTypes.STRING, allowNull: true },
          fromSupport: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          kind: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "message"
          },
          event: { type: DataTypes.STRING, allowNull: true },
          body: { type: DataTypes.TEXT, allowNull: true },
          attachments: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
          },
          createdAt: { type: DataTypes.DATE, allowNull: false },
          updatedAt: { type: DataTypes.DATE, allowNull: false }
        },
        { transaction }
      );
      await queryInterface.addIndex("SupportTickets", ["userId", "createdAt"], {
        name: "support_tickets_user_created_at",
        transaction
      });
      await queryInterface.addIndex(
        "SupportTickets",
        ["status", "lastMessageAt"],
        { name: "support_tickets_status_last_message_at", transaction }
      );
      await queryInterface.addIndex("SupportMessages", ["ticketId", "id"], {
        name: "support_messages_ticket_id",
        transaction
      });

      // The reports keep their numbers: report 7 becomes ticket CH-000007.
      await queryInterface.sequelize.query(
        `INSERT INTO "SupportTickets"
           ("id", "companyId", "userId", "companyName", "userName", "userEmail",
            "userProfile", "title", "category", "priority", "status", "location",
            "userAgent", "screen", "appUrl", "lastMessageAt",
            "lastRequesterMessageAt", "createdAt", "updatedAt")
         SELECT "id", "companyId", "userId", "companyName", "userName",
                "userEmail", "userProfile", LEFT("title", 255), 'error',
                'medium', 'open', "location", "userAgent", "screen", "appUrl",
                "createdAt", "createdAt", "createdAt", "createdAt"
           FROM "ErrorReports"`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `INSERT INTO "SupportMessages"
           ("ticketId", "userId", "userName", "fromSupport", "kind", "body",
            "attachments", "createdAt", "updatedAt")
         SELECT "id", "userId", "userName", false, 'message', "description",
                "attachments", "createdAt", "createdAt"
           FROM "ErrorReports"`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `SELECT setval(
           pg_get_serial_sequence('"SupportTickets"', 'id'),
           GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "SupportTickets"), 1),
           (SELECT COUNT(*) > 0 FROM "SupportTickets")
         )`,
        { transaction }
      );
      await queryInterface.dropTable("ErrorReports", { transaction });
    });
  },

  // The reports table comes back empty: its mail columns have no meaning for
  // a ticket, so nothing is copied back.
  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable("SupportMessages", { transaction });
      await queryInterface.dropTable("SupportTickets", { transaction });
      await queryInterface.createTable(
        "ErrorReports",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          companyId: { type: DataTypes.INTEGER, allowNull: true },
          userId: { type: DataTypes.INTEGER, allowNull: true },
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
        },
        { transaction }
      );
    });
  }
};
