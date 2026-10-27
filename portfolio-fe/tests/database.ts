import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { parseEnv } from "node:util";
import { createPool } from "../src/server/database";
import { migrate } from "../src/server/migrations";
import { createStore } from "../src/server/store";

export async function testStore() {
  const environment = new URL("../.env.local", import.meta.url);
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    (fs.existsSync(environment)
      ? parseEnv(fs.readFileSync(environment, "utf8")).TEST_DATABASE_URL
      : "");
  if (
    !connectionString ||
    !new URL(connectionString).pathname.endsWith("_test")
  )
    throw new Error(
      "Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test",
    );
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = createPool(connectionString);
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(connectionString);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const pool = createPool(url.toString());
  try {
    await migrate(pool);
  } catch (error) {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }
  return {
    ...createStore(pool),
    async close() {
      await pool.end();
      try {
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
