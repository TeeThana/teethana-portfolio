import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";

export function createPool(connectionString: string) {
  if (!connectionString)
    throw new Error("Set DATABASE_URL to a PostgreSQL connection string");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    application_name: "teethana-portfolio",
  });
  // Idle connections can fail independently of requests. Never log their URLs.
  pool.on("error", () => console.error("An idle PostgreSQL connection failed"));
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}

export async function transaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
  readOnly = false,
): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query(
      readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN",
    );
    // Transaction-local settings work with Neon's PgBouncer endpoint. Sending
    // statement_timeout in the startup packet can make that endpoint reject it.
    await client.query("SET LOCAL statement_timeout='15s'");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

export async function lockCatalog(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(786864005, 1)");
}
