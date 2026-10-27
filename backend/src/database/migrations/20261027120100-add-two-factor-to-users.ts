import { QueryInterface, DataTypes } from "sequelize";

// Zap Komunick: two-factor sign-in with an authenticator app (docs/PRD.md,
// RF-016). Setup returns the secret only to its owner; User.toJSON hides it
// from general API responses.
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "Users",
        "twoFactorEnabled",
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction }
      );
      await queryInterface.addColumn(
        "Users",
        "twoFactorSecret",
        { type: DataTypes.STRING, allowNull: true },
        { transaction }
      );
      // secret being set up, until the first code confirms it
      await queryInterface.addColumn(
        "Users",
        "twoFactorPendingSecret",
        { type: DataTypes.STRING, allowNull: true },
        { transaction }
      );
      // bcrypt hashes of the unused recovery codes
      await queryInterface.addColumn(
        "Users",
        "twoFactorRecoveryCodes",
        { type: DataTypes.JSONB, allowNull: true },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("Users", "twoFactorRecoveryCodes", {
        transaction
      });
      await queryInterface.removeColumn("Users", "twoFactorPendingSecret", {
        transaction
      });
      await queryInterface.removeColumn("Users", "twoFactorSecret", {
        transaction
      });
      await queryInterface.removeColumn("Users", "twoFactorEnabled", {
        transaction
      });
    });
  }
};
