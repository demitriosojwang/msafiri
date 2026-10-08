import {PrismaClient} from "@prisma/client";
import {spawnSync} from "node:child_process";
import {assertEmptyDatabaseBootstrap} from "./bootstrap-guard.mjs";

// Only the explicitly requested, verified empty database may be initialized.
// Normal builds do not invoke this script. No seed, reset or db-push is used.
let client;
try {
  assertEmptyDatabaseBootstrap(process.env.MIRELI_INITIALIZE_EMPTY_DATABASE, 0);
  const directUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!directUrl || !["postgres:", "postgresql:"].includes(new URL(directUrl).protocol)) {
    throw new Error("Refused: a direct PostgreSQL connection is required for migrations.");
  }
  client = new PrismaClient({datasources: {db: {url: directUrl}}, log: []});
  const rows = await client.$queryRaw`
    SELECT COUNT(*) AS count FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type = 'BASE TABLE'
  `;
  assertEmptyDatabaseBootstrap(process.env.MIRELI_INITIALIZE_EMPTY_DATABASE, Number(rows[0]?.count));
  await client.$disconnect();
  client = undefined;
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: {...process.env, DATABASE_URL: directUrl}, encoding: "utf8",
  });
  if (migration.status !== 0) {
    // Never emit raw provider errors that might contain a connection credential.
    const code = `${migration.stdout || ""}${migration.stderr || ""}`.match(/\bP\d{4}\b/)?.[0] || "MIGRATION_FAILED";
    throw new Error(`Refused: initialization failed (${code}). Investigate before retrying.`);
  }
  console.log("Empty PostgreSQL database initialized through versioned migrations. No application records were seeded.");
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("Refused:")
    ? error.message : "Database initialization stopped. Check connection and migration readiness.");
  process.exitCode = 1;
} finally {
  await client?.$disconnect();
}
