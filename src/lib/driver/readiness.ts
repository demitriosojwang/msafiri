import {isLocalDemoEnabled} from "@/lib/runtime-mode";
import {POLICY_VERSION} from "./catalogue";

// Do not open real driver intake while the deployed staff login is still the
// prototype (src/app/api/admin/auth/route.ts returns 503 in production).
// Change this only in the same reviewed change that ships verified staff auth.
const productionReviewerAuthenticationImplemented = false;

export function securePolicyUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {const url = new URL(value); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;}
  catch {return false;}
}

/** Configuration readiness is not proof of provider delivery or operational approval. */
export function driverRegistrationConfigured(): boolean {
  if (isLocalDemoEnabled()) return true;
  const scanner = process.env.DRIVER_SCAN_COMMAND;
  const reviewers = process.env.DRIVER_COMPLIANCE_REVIEWERS?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  return productionReviewerAuthenticationImplemented && !!scanner && scanner.startsWith("/") && reviewers.length > 0 &&
    (process.env.DRIVER_AUTH_SECRET?.length ?? 0) >= 32 &&
    !!process.env.AT_USERNAME && !!process.env.AT_API_KEY &&
    !!process.env.AWS_REGION && !!process.env.DRIVER_DOCUMENT_BUCKET &&
    process.env.DRIVER_POLICY_VERSION === POLICY_VERSION &&
    securePolicyUrl(process.env.DRIVER_PRIVACY_URL) && securePolicyUrl(process.env.DRIVER_TERMS_URL);
}

export function driverServiceStatus() {
  return {apiVersion: "v1", simulation: isLocalDemoEnabled(), registrationOpen: driverRegistrationConfigured(),
    supportEmail: "mirelisgr001@gmail.com",
    message: driverRegistrationConfigured() ? "Verify your phone to apply or sign in." : "Driver registration is not open yet. Please check again later."};
}
