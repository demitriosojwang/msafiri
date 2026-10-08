import {spawnSync} from "node:child_process";
// Explicit per-deployment opt-in; runs versioned migrations only. Never seeds or resets.
try {
  if(process.env.MIRELI_APPLY_DATABASE_MIGRATIONS!=="true")throw new Error();
  const directUrl=process.env.POSTGRES_URL||process.env.DATABASE_URL;
  if(!directUrl || !["postgres:","postgresql:"].includes(new URL(directUrl).protocol))throw new Error();
  const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:{...process.env,DATABASE_URL:directUrl},encoding:"utf8"});
  if(result.error || result.status!==0)throw new Error();
  console.log("Versioned database migrations applied; no application records seeded.");
}catch{
  console.error("Versioned database migration stopped. Check opt-in, connection and migration readiness before retrying.");process.exit(1);
}
