import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const environment = path.join(appDirectory, ".env.local");
if (fs.existsSync(environment)) process.loadEnvFile(environment);
// Standalone Next changes cwd. Keep local data outside generated build output.
process.env.DATABASE_PATH = path.resolve(
  appDirectory,
  process.env.DATABASE_PATH || "./data/portfolio.sqlite",
);
process.env.HOSTNAME ||= "0.0.0.0";
await import(
  pathToFileURL(
    path.join(appDirectory, ".next/standalone/portfolio-fe/server.js"),
  ).href
);
