import {isLocalDemoEnabled} from "@/lib/runtime-mode";
import {POLICY_VERSION} from "./catalogue";

export function securePolicyUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {const url = new URL(value); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;}
  catch {return false;}
}

/** Configuration readiness is not proof of provider delivery or operational approval. */
export function driverRegistrationConfigured(): boolean {
  if (isLocalDemoEnabled()) return true;
  return (process.env.DRIVER_AUTH_SECRET?.length ?? 0) >= 32 &&
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
