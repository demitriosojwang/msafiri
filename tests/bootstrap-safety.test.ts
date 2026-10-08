import {describe, expect, it} from "vitest";
import {assertEmptyDatabaseBootstrap} from "../scripts/bootstrap-guard.mjs";

describe("one-time database initialization safety", () => {
  it.each([undefined, "false", "1"])("requires explicit initialization when confirmation is %s", confirmation => {
    expect(() => assertEmptyDatabaseBootstrap(confirmation, 0)).toThrow(/explicit/);
  });
  it("refuses a database with existing application tables", () => {
    expect(() => assertEmptyDatabaseBootstrap("true", 1)).toThrow(/existing/);
  });
  it.each([Number.NaN, -1])("refuses an unknown table count %s", count => {
    expect(() => assertEmptyDatabaseBootstrap("true", count)).toThrow(/count/);
  });
  it("permits explicitly requested initialization of a verified empty database", () => {
    expect(() => assertEmptyDatabaseBootstrap("true", 0)).not.toThrow();
  });
});
