/** Simulation is restricted to an explicitly enabled, non-Vercel dev server. */
export function isLocalDemoEnabled(): boolean {
  return process.env.NODE_ENV === "development" &&
    process.env.MIRELI_DEMO_MODE === "true" && !process.env.VERCEL;
}

export function resolvePaymentMode(complete: boolean, forcedMock: boolean): "mock" | "live" {
  if (forcedMock || !complete) {
    if (!isLocalDemoEnabled()) {
      throw new Error("M-Pesa is not configured. Simulated payments are restricted to the local demo.");
    }
    return "mock";
  }
  return "live";
}
