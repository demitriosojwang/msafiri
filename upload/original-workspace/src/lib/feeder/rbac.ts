// Role-Based Access Control (RBAC) utilities.
//
// In production, the backend enforces these on EVERY endpoint via middleware.
// This client-side mirror is for UX only — hiding/showing UI based on role.
// The server is the real security boundary; the client is never trusted.

import type { Permission, Role, Session } from './types';

// Map roles to their permissions.
// Multi-role accounts (e.g., driver+passenger) get the union of permissions.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  passenger: [
    'booking:create',
    'booking:read:own',
    'booking:cancel:own',
  ],
  driver: [
    'trip:read:assigned',
    'trip:update:status',
    'location:broadcast',
    'location:read:assigned',
  ],
  admin: [
    'admin:read:all',
    'admin:manage:drivers',
    'admin:manage:pricing',
    'admin:refund:payments',
    'admin:autoassign',
    'admin:view:audit',
  ],
};

// Get all permissions for a set of roles (union)
export function permissionsForRoles(roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    ROLE_PERMISSIONS[role].forEach(p => set.add(p));
  }
  return Array.from(set);
}

// Check if a session has a specific permission
export function hasPermission(session: Session | null, permission: Permission): boolean {
  if (!session) return false;
  return session.permissions.includes(permission);
}

// Check if a session has ANY of the given permissions
export function hasAnyPermission(session: Session | null, permissions: Permission[]): boolean {
  if (!session) return false;
  return permissions.some(p => session.permissions.includes(p));
}

// Check if a session has a specific role
export function hasRole(session: Session | null, role: Role): boolean {
  if (!session) return false;
  return session.roles.includes(role);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OWNERSHIP CHECKS — the second layer of security beyond role.
// Even if two users share a role, they can only access their own data.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Can this session read a specific booking?
// Passengers can only read their own bookings (identified by isMine flag in prototype,
// or by user_id matching booking.passenger_id in production).
export function canReadBooking(session: Session | null, bookingIsMine: boolean): boolean {
  if (!session) return false;
  if (hasRole(session, 'admin')) return true; // admins can read all
  if (hasPermission(session, 'booking:read:own') && bookingIsMine) return true;
  return false;
}

// Can this session update a specific trip?
// Drivers can only update trips assigned to their own cab.
export function canUpdateTrip(session: Session | null, tripCabId: string): boolean {
  if (!session) return false;
  if (hasRole(session, 'admin')) return true;
  // Driver must have trip:update:status permission AND the trip must be their own
  if (hasPermission(session, 'trip:update:status') && session.driverProfileId === tripCabId) {
    return true;
  }
  return false;
}

// Can this session broadcast GPS location?
// Only drivers (with location:broadcast permission) can send their position.
export function canBroadcastLocation(session: Session | null): boolean {
  return hasPermission(session, 'location:broadcast');
}

// Can this session view the admin panel?
export function canAccessAdmin(session: Session | null): boolean {
  return hasAnyPermission(session, [
    'admin:read:all',
    'admin:manage:drivers',
    'admin:manage:pricing',
    'admin:refund:payments',
    'admin:autoassign',
    'admin:view:audit',
  ]);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL-BASED ROLE DETECTION
//
// The admin email is stored server-side (environment variable in production).
// When someone logs in, the backend checks their email against this list.
// If it matches → admin session. Otherwise → passenger or driver based on account.
//
// The admin email is NEVER shown in the UI. There is no "Admin" login button.
// The platform silently recognises the admin from their email.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// In production, this comes from an environment variable or database table.
// For the prototype, it's hardcoded here. Change this to your actual email.
export const ADMIN_EMAILS: string[] = [
  'demitri@msafiri.co.ke',
  'admin@msafiri.co.ke',
];

// Known driver phone numbers → driver sessions (in production, from database)
export const DRIVER_PHONES: Record<string, { name: string; cabId: string }> = {
  '+254722334455': { name: 'Mwangi', cabId: 'c9' },
  '+254733445566': { name: 'Amani', cabId: 'c2' },
};

// Detect what role(s) an account should have based on email or phone.
// This runs server-side after OTP verification.
export function detectRolesFromIdentifier(identifier: string): {
  roles: Role[];
  displayName: string;
  driverProfileId?: string;
} {
  const normalized = identifier.trim().toLowerCase();

  // Check if this is an admin email
  if (ADMIN_EMAILS.some(e => e.toLowerCase() === normalized)) {
    const name = normalized.split('@')[0];
    return {
      roles: ['admin'],
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
    };
  }

  // Check if this is a known driver phone
  if (DRIVER_PHONES[identifier]) {
    const driver = DRIVER_PHONES[identifier];
    return {
      roles: ['driver', 'passenger'],  // multi-role
      displayName: driver.name,
      driverProfileId: driver.cabId,
    };
  }

  // Default: passenger only
  const name = normalized.includes('@')
    ? normalized.split('@')[0]
    : 'Passenger';
  return {
    roles: ['passenger'],
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
  };
}

// Create a session from a login attempt
export function createSession(identifier: string): Session {
  const { roles, displayName, driverProfileId } = detectRolesFromIdentifier(identifier);
  const activeRole = roles.includes('admin') ? 'admin' : roles[0];

  return {
    userId: `u-${Date.now()}`,
    displayName,
    phone: identifier.includes('@') ? '' : identifier,
    roles,
    activeRole,
    driverProfileId,
    permissions: permissionsForRoles(roles),
    loginAt: Date.now(),
  };
}
