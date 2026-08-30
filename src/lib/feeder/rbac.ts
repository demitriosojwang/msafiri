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
// SEED SESSIONS — for the prototype, we simulate logged-in users.
// In production, these come from the auth backend after OTP/password verification.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { Cab } from './types';

export const SEED_SESSIONS: Record<string, Session> = {
  passenger: {
    userId: 'u-passenger-1',
    displayName: 'Aisha M.',
    phone: '+254712345678',
    roles: ['passenger'],
    activeRole: 'passenger',
    permissions: permissionsForRoles(['passenger']),
    loginAt: Date.now(),
  },
  driver: {
    userId: 'u-driver-mwangi',
    displayName: 'Mwangi',
    phone: '+254722334455',
    roles: ['driver', 'passenger'],  // multi-role: driver who can also book as passenger
    activeRole: 'driver',
    driverProfileId: 'c9',  // Patrick's cab (the active driver in the seed)
    permissions: permissionsForRoles(['driver', 'passenger']),
    loginAt: Date.now(),
  },
  admin: {
    userId: 'u-admin-1',
    displayName: 'Demitri',
    phone: '+254700000000',
    roles: ['admin'],
    activeRole: 'admin',
    permissions: permissionsForRoles(['admin']),
    loginAt: Date.now(),
  },
};

// Map cab driver names to their driver profile IDs for the driver session
export function findDriverCabId(cabs: Cab[], driverName: string): string | undefined {
  const cab = cabs.find(c => c.driverName === driverName);
  return cab?.id;
}
