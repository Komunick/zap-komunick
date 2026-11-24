import { Sequelize, WhereOptions } from "sequelize";
import nameMatches from "../../helpers/NameSearch";

const sequelize = new Sequelize({ dialect: "postgres", logging: false });
const generator = sequelize.getQueryInterface().queryGenerator as {
  getWhereConditions(whereClause: WhereOptions): string;
};

// Postgres string literal: '...' with embedded quotes doubled.
const STRING_LITERAL = /'(?:[^']|'')*'/g;

const sqlFor = (searchParam: string): string =>
  generator.getWhereConditions(nameMatches("contact.name", searchParam));

describe("nameMatches", () => {
  afterAll(() => sequelize.close());

  it("strips accents, case, spaces and punctuation from both sides", () => {
    const sql = sqlFor("j.b. fraga");
    const flat = (value: string) =>
      `REGEXP_REPLACE(LOWER(UNACCENT(${value})), '[\\s!-/:-@\\[-\`{-~´¨°·•]+', '', 'g')`;

    expect(sql).toBe(
      `STRPOS(${flat('"contact"."name"')}, NULLIF(${flat(
        "'j.b. fraga'"
      )}, '')) > 0`
    );
  });

  it.each([
    "x') OR 1=1 --",
    "x' OR '1'='1",
    '\'); DROP TABLE "Contacts"; --',
    "d'ávila",
    "100%",
    "a_b\\c"
  ])("keeps %p as a value, without changing the query", searchParam => {
    const structureOf = (sql: string) => sql.replace(STRING_LITERAL, "''");

    expect(structureOf(sqlFor(searchParam))).toBe(
      structureOf(sqlFor("padaria"))
    );
  });
});
