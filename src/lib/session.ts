import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Lightweight signed-cookie sessions (HMAC-SHA256).
 * Prototype-grade: swap for JWT + httpOnly cookie infra in production,
 * but the boundary is the same — the cookie is signed server-side and
 * every API route re-verifies role + identity on every request.
 */

const SECRET =
  process.env.SESSION_SECRET || "mireli-dev-secret-change-in-production";

const PASSENGER_COOKIE = "mireli_session";
const ADMIN_COOKIE = "mireli_admin";

export type SessionRole = "passenger" | "admin";

export interface Session {
  role: SessionRole;
  id: string; // passenger or admin identity id
  name: string;
  identifier: string; // phone (passenger) or email (admin)
  exp: number; // epoch ms
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // constant-time compare
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!s.exp || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getPassengerSession(): Promise<Session | null> {
  const store = await cookies();
  const s = decodeSession(store.get(PASSENGER_COOKIE)?.value);
  return s && s.role === "passenger" ? s : null;
}

export async function getAdminSession(): Promise<Session | null> {
  const store = await cookies();
  const s = decodeSession(store.get(ADMIN_COOKIE)?.value);
  return s && s.role === "admin" ? s : null;
}

export function passengerCookieOptions() {
  return {
    name: PASSENGER_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function adminCookieOptions() {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  };
}

export { PASSENGER_COOKIE, ADMIN_COOKIE };

// ─── Phone normalization (Kenyan numbers) ───────────────────────────────────

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let n = digits.startsWith("+") ? digits.slice(1) : digits;
  if (n.startsWith("254")) n = n.slice(3);
  else if (n.startsWith("0")) n = n.slice(1);
  if (/^[17]\d{8}$/.test(n)) return `+254${n}`;
  return null;
}

export function isAdminEmail(
  email: string,
  adminEmails: string[]
): boolean {
  return adminEmails.map((e) => e.toLowerCase().trim()).includes(email.toLowerCase().trim());
}
