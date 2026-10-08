import {spawnSync} from "node:child_process";

const commands = [
  ["node_modules/prisma/build/index.js", "generate"],
  ...(process.env.MIRELI_INITIALIZE_EMPTY_DATABASE === "true" ? [["scripts/bootstrap-empty-database.mjs"]] : []),
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
];
for (const command of commands) {
  const result = spawnSync(process.execPath, command, {stdio: "inherit", env: process.env});
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
