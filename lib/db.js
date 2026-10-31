import { neon } from "@neondatabase/serverless";

// The app's Postgres database (Neon), shared by the price index and synced
// data. Returns null when no database is connected.

let testQuery = null;
let neonQuery = null;
const resetters = new Set();

// Lets tests run the real SQL against an in-memory Postgres
export function setTestDatabase(query) {
  testQuery = query;
  for (const reset of resetters) reset();
}

export function getQuery() {
  if (testQuery) return testQuery;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!neonQuery) {
    const sql = neon(url);
    neonQuery = (text, params) => sql.query(text, params);
  }
  return neonQuery;
}

// Wraps a schema setup so it runs once per database, and again after a
// failure or a switch of test database. Returns db(), which resolves to the
// query function, or null with no database.
export function withSchema(createSchema) {
  let ready = null;
  resetters.add(() => {
    ready = null;
  });
  return async function db() {
    const query = getQuery();
    if (!query) return null;
    ready ??= createSchema(query).catch((err) => {
      ready = null;
      throw err;
    });
    await ready;
    return query;
  };
}
