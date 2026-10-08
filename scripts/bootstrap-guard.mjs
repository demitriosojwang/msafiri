export function assertEmptyDatabaseBootstrap(confirmation, applicationTableCount) {
  if (confirmation !== "true") throw new Error("Refused: an explicit one-time initialization setting is required.");
  if (!Number.isSafeInteger(applicationTableCount) || applicationTableCount < 0) throw new Error("Refused: the application table count is unknown.");
  if (applicationTableCount !== 0) throw new Error("Refused: existing application tables require a reviewed migration and backup.");
}
