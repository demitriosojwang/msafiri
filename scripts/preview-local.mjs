import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  throw new Error("The synthetic preview is for a local development machine only.");
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = join(root, ".local");
mkdirSync(local, { recursive: true });
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8")
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../node_modules/.prisma/client"');
writeFileSync(join(local, "schema.prisma"), schema);
const databaseUrl = "file:./preview.db"; // resolved against .local/schema.prisma
const env = {
  ...process.env, NODE_ENV: "development", MIRELI_DEMO_MODE: "true", MPESA_MODE: "mock",
  DATABASE_URL: databaseUrl, SESSION_SECRET: randomBytes(48).toString("hex"),
  MIRELI_LOCAL_PREVIEW_DIR: local, TZ: "Africa/Nairobi",
};
function run(entry, args = []) {
  const result = spawnSync(process.execPath, [join(root, entry), ...args], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("node_modules/prisma/build/index.js", ["generate", "--schema", ".local/schema.prisma"]);
run("node_modules/prisma/build/index.js", ["db", "push", "--schema", ".local/schema.prisma"]);
run("scripts/seed-preview.mjs");
console.log("Synthetic local preview: http://127.0.0.1:3100 — no live bookings or money.");
run("node_modules/next/dist/bin/next", ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"]);
