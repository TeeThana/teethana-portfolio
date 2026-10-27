import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "../src/server/database";
import { migrate } from "../src/server/migrations";
import { createStore } from "../src/server/store";
import { exportSnapshot, importSnapshot } from "../src/server/snapshots";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const environment = path.join(appDirectory, ".env.local");
if (fs.existsSync(environment)) process.loadEnvFile(environment);

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (
    !["migrate", "seed", "backup", "restore", "import-sqlite"].includes(command)
  )
    throw new Error("Choose migrate, seed, backup, restore, or import-sqlite");
  const pool = createPool(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  );
  try {
    if (command === "migrate") {
      console.log(`PostgreSQL schema is at version ${await migrate(pool)}.`);
    } else if (command === "seed") {
      console.log(
        (await createStore(pool).initialize())
          ? "Initialized public portfolio data."
          : "Existing profile preserved; no seed changes made.",
      );
    } else if (command === "backup") {
      const destination = path.resolve(
        argument ||
          path.join(
            appDirectory,
            "backups",
            `portfolio-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
          ),
      );
      const snapshot = await exportSnapshot(pool);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, JSON.stringify(snapshot, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      console.log(`Consistent application backup saved to ${destination}`);
    } else if (command === "restore") {
      if (!argument)
        throw new Error("Provide the path to an application backup JSON file");
      const result = await importSnapshot(
        pool,
        JSON.parse(fs.readFileSync(path.resolve(argument), "utf8")),
      );
      console.log(
        `Restored profile and ${result.projects} projects into empty PostgreSQL tables.`,
      );
    } else {
      const source = path.resolve(
        argument || path.join(appDirectory, "data/portfolio.sqlite"),
      );
      if (!fs.existsSync(source))
        throw new Error("SQLite source file does not exist");
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(source, { readOnly: true });
      try {
        db.exec("BEGIN");
        const version = db.prepare("PRAGMA user_version").get();
        if (version?.user_version !== 1)
          throw new Error("Only legacy SQLite schema version 1 is supported");
        const profile = db
          .prepare("SELECT document FROM profile WHERE id=1")
          .get();
        if (!profile) throw new Error("The source contains no profile");
        const projects = db
          .prepare(
            `SELECT id,github_id AS githubId,slug,title,summary,content,role,year,
          stack_json AS stack,cover_color AS coverColor,repo_url AS repoUrl,live_url AS liveUrl,
          active,featured,sort_order AS sortOrder,available,language,stars,updated_at AS updatedAt
          FROM projects ORDER BY sort_order,title`,
          )
          .all()
          .map((row) => ({
            ...row,
            stack: JSON.parse(String(row.stack)),
            active: Boolean(row.active),
            featured: Boolean(row.featured),
            available: Boolean(row.available),
            updatedAt: new Date(String(row.updatedAt)).toISOString(),
          }));
        const metadata = db
          .prepare("SELECT key,value FROM metadata ORDER BY key")
          .all();
        const result = await importSnapshot(pool, {
          format: "teethana-portfolio",
          version: 1,
          profile: JSON.parse(String(profile.document)),
          projects,
          metadata,
        });
        db.exec("COMMIT");
        console.log(
          `Imported profile and ${result.projects} projects. The SQLite source was opened read-only and preserved.`,
        );
      } finally {
        db.close();
      }
    }
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Database command failed";
  console.error(
    message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]"),
  );
  process.exitCode = 1;
});
