import fs from "node:fs";
import path from "node:path";
if (process.env.VERCEL) process.exit(0);
const output = path.resolve(".next/standalone/portfolio-fe");
if (!fs.existsSync(path.join(output, "server.js")))
  throw new Error("Unexpected standalone output layout");
fs.cpSync(path.resolve("public"), path.join(output, "public"), {
  recursive: true,
});
fs.mkdirSync(path.join(output, ".next"), { recursive: true });
fs.cpSync(path.resolve(".next/static"), path.join(output, ".next/static"), {
  recursive: true,
});
console.log(
  "Standalone server is ready, including local public and static assets.",
);
