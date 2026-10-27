import type { Pool } from "pg";
import { transaction } from "./database";

const migrations = [
  {
    version: 1,
    sql: `
    CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK (id=1), document JSONB NOT NULL);
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, github_id BIGINT UNIQUE, slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '', year TEXT NOT NULL DEFAULT '',
      stack_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(stack_json)='array'),
      cover_color TEXT NOT NULL DEFAULT '#1e3d78', repo_url TEXT NOT NULL,
      live_url TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT FALSE,
      featured BOOLEAN NOT NULL DEFAULT FALSE, sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order>=0),
      available BOOLEAN NOT NULL DEFAULT TRUE, language TEXT NOT NULL DEFAULT '',
      stars INTEGER NOT NULL DEFAULT 0 CHECK (stars>=0), updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX projects_public_order ON projects(sort_order, title) WHERE active AND available;
  `,
  },
];

export async function migrate(pool: Pool) {
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(786864005, 2)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    if (rows.some(({ version }) => version > migrations.length))
      throw new Error("Database schema is newer than this application");
    for (const migration of migrations) {
      if (rows.some(({ version }) => version === migration.version)) continue;
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        migration.version,
      ]);
    }
    return migrations.length;
  });
}
