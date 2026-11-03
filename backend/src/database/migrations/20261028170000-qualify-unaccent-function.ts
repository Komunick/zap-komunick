import { QueryInterface } from "sequelize";

// pg_dump restores with an empty search_path. Keep the wrapper's existing
// signature and behavior while resolving the installed public extension exactly.
const qualifyUnaccent = (queryInterface: QueryInterface) =>
  queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
    RETURNS text AS $$
      SELECT public.unaccent($1);
    $$ LANGUAGE sql IMMUTABLE;
  `);

export default {
  up: qualifyUnaccent,
  // Existing tag indexes depend on this function. A code rollback preserves the
  // compatible, qualified wrapper instead of dropping it or restoring the defect.
  down: qualifyUnaccent
};
