import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalDemoEnabled, resolvePaymentMode } from "@/lib/runtime-mode";

afterEach(() => vi.unstubAllEnvs());
describe("simulation boundary", () => {
  it("rejects missing payment credentials in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIRELI_DEMO_MODE", "true");
    expect(() => resolvePaymentMode(false, false)).toThrow();
    expect(() => resolvePaymentMode(true, true)).toThrow();
  });
  it("never enables demo on Vercel", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MIRELI_DEMO_MODE", "true");
    vi.stubEnv("VERCEL", "1");
    expect(isLocalDemoEnabled()).toBe(false);
  });
  it("requires explicit local opt-in and supports real credentials", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("MIRELI_DEMO_MODE", "false");
    expect(() => resolvePaymentMode(false, false)).toThrow();
    vi.stubEnv("MIRELI_DEMO_MODE", "true");
    expect(resolvePaymentMode(false, false)).toBe("mock");
    expect(resolvePaymentMode(true, false)).toBe("live");
  });
});
