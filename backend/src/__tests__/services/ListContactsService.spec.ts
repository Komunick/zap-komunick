import sequelize from "../../database";
import Contact from "../../models/Contact";
import ListContactsService from "../../services/ContactServices/ListContactsService";

// Postgres string literal: '...' with embedded quotes doubled.
const STRING_LITERAL = /'(?:[^']|'')*'/g;

// Builds the WHERE clause the service sends to Postgres, without a database.
const whereClauseFor = async (searchParam: string): Promise<string> => {
  const findAndCountAll = jest
    .spyOn(Contact, "findAndCountAll")
    .mockResolvedValue({ count: 0, rows: [] } as never);

  await ListContactsService({ searchParam, companyId: 1 });

  const [options] = findAndCountAll.mock.calls[0];
  findAndCountAll.mockRestore();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { queryGenerator } = sequelize.getQueryInterface() as any;
  return queryGenerator.whereQuery(options.where, { model: Contact });
};

// What is left of the SQL once every string value is blanked out.
const structureOf = (sql: string): string => sql.replace(STRING_LITERAL, "''");

describe("ListContactsService search", () => {
  afterAll(() => sequelize.close());

  it.each([
    "x') OR 1=1 --",
    "x' OR '1'='1",
    '\'); DROP TABLE "Contacts"; --',
    "') || (SELECT version()) || ('",
    "d'ávila"
  ])("keeps %p as a value, without changing the query", async searchParam => {
    const reference = structureOf(await whereClauseFor("padaria"));

    expect(structureOf(await whereClauseFor(searchParam))).toBe(reference);
  });

  it("compares the unaccented, lowercased name with the unaccented search text", async () => {
    const sql = await whereClauseFor("  JOÃO  ");

    expect(sql).toContain(`LOWER(UNACCENT("Contact"."name")) LIKE`);
    expect(sql).toContain(`UNACCENT('joão')`);
  });
});
