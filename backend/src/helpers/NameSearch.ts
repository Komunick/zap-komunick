import { Op, col, fn, where } from "sequelize";

// Zap Komunick: whitespace, ASCII punctuation and the loose marks people type
// as an apostrophe or a bullet. UNACCENT runs first and already turns
// typographic quotes and dashes into their ASCII form.
const SEPARATORS = "[\\s!-/:-@\\[-`{-~´¨°·•]+";

const flatten = (value: unknown) =>
  fn("REGEXP_REPLACE", fn("LOWER", fn("UNACCENT", value)), SEPARATORS, "", "g");

/**
 * Condition that finds a name whatever its accents, case, spacing and
 * punctuation: "jb fraga" finds "J.B. Fraga" and "j.b. fraga" finds
 * "JB Fraga". A search made only of punctuation matches nothing here (NULLIF
 * turns it into NULL), so the caller keeps its literal comparison next to
 * this one.
 *
 * `column` is a column path such as "contact.name"; `searchParam` is user
 * text and only reaches the query as a value escaped by Sequelize.
 */
const nameMatches = (column: string, searchParam: string) =>
  where(
    fn("STRPOS", flatten(col(column)), fn("NULLIF", flatten(searchParam), "")),
    Op.gt,
    0
  );

export default nameMatches;
