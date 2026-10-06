import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { encodeSession, decodeSession, adminCookieOptions, passengerCookieOptions } from "@/lib/session";
import type { Session } from "@/lib/session";

beforeEach(() => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SESSION_SECRET", "test-only-".repeat(8)); });
afterEach(() => vi.unstubAllEnvs());
const session = (): Session => ({ role: "passenger", id: "p1", name: "Sample", identifier: "+254700000001", exp: Date.now() + 60000 });
describe("signed sessions", () => {
  it("roundtrips a valid session", () => { const s = session(); expect(decodeSession(encodeSession(s))).toEqual(s); });
  it("rejects tampering and trailing token segments", () => {
    const token = encodeSession(session());
    expect(decodeSession("x" + token)).toBeNull();
    expect(decodeSession(token + ".extra")).toBeNull();
  });
  it("rejects expired and invalid claims even when signed", () => {
    expect(decodeSession(encodeSession({ ...session(), exp: Date.now() - 1 }))).toBeNull();
    expect(decodeSession(encodeSession({ ...session(), role: "owner" } as unknown as Session))).toBeNull();
    expect(decodeSession(encodeSession({ ...session(), id: "" }))).toBeNull();
  });
  it("rejects malformed unicode signatures without throwing", () => {
    const body = encodeSession(session()).split(".")[0];
    expect(decodeSession(body + "." + "é".repeat(43))).toBeNull();
  });
  it("refuses signing without a production secret", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => encodeSession(session())).toThrow("SESSION_SECRET");
  });
  it("uses secure, HTTP-only cookies in production", () => {
    expect(adminCookieOptions()).toMatchObject({ secure: true, httpOnly: true });
    expect(passengerCookieOptions()).toMatchObject({ secure: true, httpOnly: true });
  });
});
