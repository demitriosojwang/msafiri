// Security utilities for msafiri.
//
// In production, ALL of these checks run on the server (NestJS middleware).
// The client-side versions here are for UX only — never trust the client.
//
// The server is the real security boundary. The client is never trusted.

import type { Session, Permission, Role } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. RATE LIMITING — prevents OTP brute-force
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCKOUT_MINUTES = 15;
export const OTP_LENGTH = 6;  // 6 digits = 1M combinations (harder to brute-force than 4)

type LoginAttempt = {
  identifier: string;
  attempts: number;
  lockedUntil: number | null;  // epoch ms
};

// In production, this is Redis. Here it's in-memory.
const loginAttempts = new Map<string, LoginAttempt>();

export function recordFailedAttempt(identifier: string): { locked: boolean; remaining: number; lockoutMin: number } {
  const normalized = identifier.trim().toLowerCase();
  const existing = loginAttempts.get(normalized) ?? { identifier: normalized, attempts: 0, lockedUntil: null };

  existing.attempts++;
  if (existing.attempts >= OTP_MAX_ATTEMPTS) {
    existing.lockedUntil = Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000;
  }
  loginAttempts.set(normalized, existing);

  const remaining = Math.max(0, OTP_MAX_ATTEMPTS - existing.attempts);
  const locked = existing.lockedUntil !== null && existing.lockedUntil > Date.now();
  return { locked, remaining, lockoutMin: OTP_LOCKOUT_MINUTES };
}

export function isRateLimited(identifier: string): { limited: boolean; remainingMs: number } {
  const normalized = identifier.trim().toLowerCase();
  const attempt = loginAttempts.get(normalized);
  if (!attempt || !attempt.lockedUntil) return { limited: false, remainingMs: 0 };
  if (attempt.lockedUntil <= Date.now()) {
    // Lockout expired — reset
    loginAttempts.delete(normalized);
    return { limited: false, remainingMs: 0 };
  }
  return { limited: true, remainingMs: attempt.lockedUntil - Date.now() };
}

export function clearAttempts(identifier: string): void {
  loginAttempts.delete(identifier.trim().toLowerCase());
}

export function fmtLockoutRemaining(ms: number): string {
  const min = Math.ceil(ms / 60 / 1000);
  if (min < 1) return 'less than 1 minute';
  return `${min} minutes`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. SESSION EXPIRY — auto-logout after inactivity
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;  // 15 minutes
export const SESSION_WARNING_MS = 2 * 60 * 1000;   // warn 2 min before expiry

export function isSessionExpired(session: Session | null): boolean {
  if (!session) return true;
  return Date.now() - session.loginAt > SESSION_TIMEOUT_MS;
}

// In production, the JWT has an `exp` claim. The server rejects expired tokens.
// On the client, we check expiry and redirect to login.
export function getSessionTimeRemaining(session: Session | null): number {
  if (!session) return 0;
  const elapsed = Date.now() - session.loginAt;
  return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
}

export function shouldWarnSessionExpiry(session: Session | null): boolean {
  const remaining = getSessionTimeRemaining(session);
  return remaining > 0 && remaining <= SESSION_WARNING_MS;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. ADMIN 2FA — admin accounts require a second factor beyond OTP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// In production: TOTP (Google Authenticator / Authy) or hardware key (YubiKey).
// For the prototype: a static access code (would be TOTP in production).
export const ADMIN_2FA_CODE = 'msafiri2026';

export function requires2FA(roles: Role[]): boolean {
  return roles.includes('admin');
}

export function verify2FA(code: string): boolean {
  // In production: verify TOTP code (time-based, 30-second window)
  // For prototype: compare against static code
  return code === ADMIN_2FA_CODE;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. INPUT SANITIZATION — prevents XSS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Strip HTML tags and scripts from user input.
// In production, the server does this too (defense in depth).
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')    // strip <script> tags
    .replace(/<[^>]*>/g, '')                          // strip all HTML tags
    .replace(/javascript:/gi, '')                     // strip javascript: URIs
    .replace(/on\w+\s*=/gi, '')                       // strip onX= event handlers
    .trim()
    .slice(0, 200);                                   // max 200 chars
}

// Validate phone number format (E.164 or local Kenyan format)
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Validate identifier (email or phone)
export function isValidIdentifier(identifier: string): boolean {
  return isValidEmail(identifier) || isValidPhone(identifier);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. AUDIT LOG — track all state-changing actions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;          // e.g. 'booking.create', 'admin.autoassign'
  entityType: string;      // e.g. 'booking', 'cab', 'payment'
  entityId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  ipAddress?: string;      // in production, captured server-side
};

// In production, this is a PostgreSQL table with append-only writes.
// Here it's in-memory for the prototype.
const auditLog: AuditEntry[] = [];

export function logAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  auditLog.push({
    ...entry,
    id: `audit-${auditLog.length + 1}`,
    timestamp: Date.now(),
  });
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return auditLog.slice(-limit).reverse();
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. SERVER-SIDE ENDPOINT GUARDS — documentation for the production backend
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Every API endpoint must check permissions AND ownership before processing.
// This is the NestJS middleware/guard that runs BEFORE the route handler.
//
// Pattern:
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')                    // role check
//   @Ownership('booking', 'id')        // ownership check (custom decorator)
//   @Post('/bookings/:id/cancel')
//
// The guard verifies:
//   1. JWT is valid and not expired
//   2. Token's role matches the required role for this endpoint
//   3. For ownership: the resource belongs to the requesting user
//   4. Rate limit not exceeded
//   5. Request passes CSRF token check (for state-changing operations)

export type EndpointGuard = {
  method: string;          // GET, POST, PATCH, DELETE
  path: string;            // '/api/v1/bookings/:id'
  requiredPermission: Permission;
  ownershipCheck?: 'own' | 'assigned' | 'any';  // who can access
  rateLimit?: { window: string; max: number };  // e.g. '1m', 10
  csrfProtected?: boolean;
};

export const ENDPOINT_GUARDS: EndpointGuard[] = [
  // Passenger endpoints
  { method: 'POST',   path: '/api/v1/quotes',           requiredPermission: 'booking:create',          ownershipCheck: 'any',   rateLimit: { window: '1m', max: 30 } },
  { method: 'POST',   path: '/api/v1/bookings',         requiredPermission: 'booking:create',          ownershipCheck: 'any',   rateLimit: { window: '1m', max: 5 }, csrfProtected: true },
  { method: 'GET',    path: '/api/v1/bookings/:id',     requiredPermission: 'booking:read:own',        ownershipCheck: 'own' },
  { method: 'POST',   path: '/api/v1/bookings/:id/cancel', requiredPermission: 'booking:cancel:own',  ownershipCheck: 'own',   csrfProtected: true },
  { method: 'POST',   path: '/api/v1/bookings/:id/payment', requiredPermission: 'booking:create',     ownershipCheck: 'own',   rateLimit: { window: '1m', max: 3 }, csrfProtected: true },

  // Driver endpoints
  { method: 'GET',    path: '/api/v1/trips/assigned',   requiredPermission: 'trip:read:assigned',      ownershipCheck: 'assigned' },
  { method: 'GET',    path: '/api/v1/trips/:id',        requiredPermission: 'trip:read:assigned',      ownershipCheck: 'assigned' },
  { method: 'PATCH',  path: '/api/v1/trips/:id/status', requiredPermission: 'trip:update:status',     ownershipCheck: 'assigned', csrfProtected: true },
  { method: 'POST',   path: '/api/v1/drivers/me/location', requiredPermission: 'location:broadcast', ownershipCheck: 'own',   rateLimit: { window: '15s', max: 1 } },

  // Webhook (no auth — verified by signature)
  { method: 'POST',   path: '/api/v1/webhooks/mpesa',   requiredPermission: 'booking:create',          ownershipCheck: 'any' },

  // Admin endpoints
  { method: 'GET',    path: '/api/v1/admin/arrivals/:trainId', requiredPermission: 'admin:read:all',  ownershipCheck: 'any' },
  { method: 'POST',   path: '/api/v1/admin/autoassign',  requiredPermission: 'admin:autoassign',       ownershipCheck: 'any',   csrfProtected: true },
  { method: 'POST',   path: '/api/v1/admin/refunds',     requiredPermission: 'admin:refund:payments',  ownershipCheck: 'any',   csrfProtected: true },
  { method: 'GET',    path: '/api/v1/admin/audit-logs',  requiredPermission: 'admin:view:audit',       ownershipCheck: 'any' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. ANTI-ENUMERATION — same response for known/unknown identifiers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// The login endpoint must return the SAME response whether or not the email exists.
// Otherwise, attackers can probe which emails are registered.
//
// CORRECT:
//   POST /auth/otp/send
//   → 200 { "message": "If this email is registered, an OTP has been sent." }
//
// WRONG:
//   POST /auth/otp/send
//   → 404 { "error": "Email not found" }   // ← leaks that email doesn't exist
//
// For the prototype, the login screen always proceeds to the OTP step
// regardless of whether the identifier is recognized.

export const ANTI_ENUMERATION_MESSAGE = 'If this account exists, a verification code has been sent.';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. CSRF PROTECTION — for state-changing operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// In production:
// - Use SameSite=Strict cookies for session tokens
// - Double-submit cookie pattern for CSRF tokens
// - Verify Origin header on POST/PATCH/DELETE
//
// For the prototype, we document which endpoints need CSRF protection
// (see csrfProtected: true in ENDPOINT_GUARDS above).
