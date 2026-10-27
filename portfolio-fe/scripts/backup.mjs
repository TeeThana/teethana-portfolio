import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const environment = path.join(appDirectory, ".env.local");
if (fs.existsSync(environment)) process.loadEnvFile(environment);
const source = path.resolve(
  appDirectory,
  process.env.DATABASE_PATH || "./data/portfolio.sqlite",
);
const destination = path.resolve(
  process.argv[2] ||
    path.join(
      path.dirname(source),
      "backups",
      `portfolio-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    ),
);
async function main() {
  if (!fs.existsSync(source))
    throw new Error(
      "Source database does not exist. Start the application first.",
    );
  if (fs.existsSync(destination))
    throw new Error(
      "The destination already exists. Choose a new backup filename.",
    );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, destination);
  } finally {
    database.close();
  }
  console.log(`Consistent SQLite backup saved to ${destination}`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
