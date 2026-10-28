import migration from "../../database/migrations/20261027160000-create-contact-external-client-links";
import { QueryInterface } from "sequelize";

it("creates the scoped mapping atomically without touching vendor or business records", async () => {
  const transaction = {};
  const queryInterface = {
    sequelize: {
      transaction: jest.fn(async operation => operation(transaction))
    },
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    dropTable: jest.fn()
  };
  await migration.up(queryInterface as unknown as QueryInterface);
  expect(queryInterface.createTable).toHaveBeenCalledWith(
    "ContactExternalClientLinks",
    expect.objectContaining({
      companyId: expect.objectContaining({
        references: { model: "Companies", key: "id" },
        onDelete: "CASCADE"
      }),
      contactId: expect.objectContaining({
        references: { model: "Contacts", key: "id" },
        onDelete: "CASCADE"
      })
    }),
    { transaction }
  );
  expect(queryInterface.addConstraint).toHaveBeenCalledWith(
    "ContactExternalClientLinks",
    {
      fields: ["companyId", "contactId", "provider", "externalClientId"],
      type: "unique",
      name: "contact_external_client_links_scope_unique",
      transaction
    }
  );
  expect(queryInterface.dropTable).not.toHaveBeenCalled();
});

it("refuses a destructive rollback of the mapping", async () => {
  await expect(migration.down()).rejects.toThrow(
    "Preserve ContactExternalClientLinks"
  );
});
