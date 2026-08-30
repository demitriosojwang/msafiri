'use client';

import { create } from 'zustand';
import type { Booking, Cab, PickupRequest, Settings, BookingKind, PickupKind } from '@/lib/feeder/types';
import {
  DRIVER_STATS,
  SEED_BOOKINGS,
  SEED_UNASSIGNED,
  SEED_CABS,
  SEED_REQUESTS,
  SETTINGS,
  STAGES,
  TRAINS,
  ACTIVE_DRIVER_ID,
  todayStr,
} from '@/lib/feeder/seed';
import { computeTripTiming, nudgeFare, computeFare, canDriverAcceptCharter } from '@/lib/feeder/calc';
import { computeDriverPosition } from '@/lib/feeder/gps';
import { createSession, permissionsForRoles } from '@/lib/feeder/rbac';
import type { Session, DriverPosition, Permission } from '@/lib/feeder/types';

export type Role = 'passenger' | 'driver' | 'admin';
export type PassengerDirection = 'inbound' | 'outbound';

interface FeederState {
  // Auth / session
  session: Session | null;
  role: Role;                    // = session?.activeRole (kept for backward compat)
  // GPS tracking
  driverPositions: Record<string, DriverPosition>;  // cabId → live position
  // Core data
  settings: Settings;
  cabs: Cab[];
  bookings: Booking[];
  requests: PickupRequest[];
  // Passenger view state
  passengerDirection: PassengerDirection;
  selectedDate: string;            // YYYY-MM-DD
  selectedTrainId: string;
  selectedStageId: string | null;
  // Booking form state
  pickupKind: PickupKind;
  offStageDistanceKm: number;
  bookingKind: BookingKind;
  seatsRequested: number;          // how many seats the passenger wants (pooled only)
  // Driver view state
  activeDriverCabId: string;
  driverStats: typeof DRIVER_STATS;

  // Actions
  setRole: (r: Role) => void;
  // Auth actions
  login: (identifier: string) => void;
  logout: () => void;
  switchRole: (r: Role) => void;
  hasPermission: (p: Permission) => boolean;
  // GPS actions
  updateDriverPosition: (cabId: string) => void;
  startGpsSimulation: (cabId: string) => void;
  stopGpsSimulation: () => void;
  setPassengerDirection: (d: PassengerDirection) => void;
  setSelectedDate: (d: string) => void;
  setSelectedTrainId: (id: string) => void;
  setSelectedStageId: (id: string | null) => void;
  setPickupKind: (k: PickupKind) => void;
  setOffStageDistanceKm: (km: number) => void;
  setBookingKind: (k: BookingKind) => void;
  setSeatsRequested: (n: number) => void;

  bookSeat: (cabId: string, passengerName: string, pickupPoint: string, hasTicket: boolean) => string | null;
  bookCharter: (cabId: string, passengerName: string, pickupPoint: string, hasTicket: boolean) => string | null;
  cancelBooking: (bookingId: string) => void;
  acceptRequest: (requestId: string, cabId: string) => void;
  acceptCharterRequest: (requestId: string, cabId: string) => void;
  declineRequest: (requestId: string) => void;
  startTrip: (cabId: string) => void;
  assignCabToStage: (cabId: string, stageId: string) => void;
  autoAssign: (trainId: string) => { assigned: number; unassigned: number; details: string[] };

  // Selectors
  getCab: (id: string) => Cab | undefined;
  getStage: (id: string) => typeof STAGES[0] | undefined;
  getTrain: (id: string) => typeof TRAINS[0] | undefined;
  getCabsForTrain: (trainId: string) => Cab[];
  getCabsForStage: (stageId: string, direction: Direction) => Cab[];
  getBookingsForCab: (cabId: string) => Booking[];
  getRequestsForDriver: (cabId: string) => PickupRequest[];
  getCharterRequestsForDriver: (cabId: string) => PickupRequest[];
  getPassengersWaitingAtStage: (stageId: string) => number;
}

type Direction = 'inbound' | 'outbound';

let bookingCounter = 100;
let gpsInterval: ReturnType<typeof setInterval> | null = null;

export const useFeederStore = create<FeederState>((set, get) => ({
  session: null,
  role: 'passenger',
  driverPositions: {},
  settings: SETTINGS,
  cabs: SEED_CABS,
  bookings: [...SEED_BOOKINGS, ...SEED_UNASSIGNED],
  requests: SEED_REQUESTS,
  passengerDirection: 'inbound',
  selectedDate: todayStr(),
  selectedTrainId: 't-dep-2',
  selectedStageId: null,
  pickupKind: 'stage',
  offStageDistanceKm: 0,
  bookingKind: 'pooled',
  seatsRequested: 1,
  activeDriverCabId: ACTIVE_DRIVER_ID,
  driverStats: DRIVER_STATS,

  setRole: (r) => {
    // Switch active role if the session supports it (multi-role accounts)
    const session = get().session;
    if (session && session.roles.includes(r)) {
      const updated = { ...session, activeRole: r, permissions: permissionsForRoles(session.roles) };
      set({ session: updated, role: r });
    } else {
      set({ role: r });
    }
  },

  // ━━ Auth actions ━━
  login: (identifier: string) => {
    // In production, the backend verifies OTP then returns a JWT with the user's roles.
    // Here we simulate by detecting roles from the email/phone identifier.
    const session = createSession(identifier);
    set({ session, role: session.activeRole });
  },

  logout: () => {
    // Stop any GPS simulation
    if (gpsInterval) {
      clearInterval(gpsInterval);
      gpsInterval = null;
    }
    set({ session: null, role: 'passenger', driverPositions: {} });
  },

  switchRole: (r) => {
    const session = get().session;
    if (session && session.roles.includes(r)) {
      const updated = { ...session, activeRole: r };
      set({ session: updated, role: r });
    }
  },

  hasPermission: (p) => {
    const session = get().session;
    if (!session) return false;
    return session.permissions.includes(p);
  },

  // ━━ GPS actions ━━
  updateDriverPosition: (cabId) => {
    const cab = get().cabs.find(c => c.id === cabId);
    if (!cab) return;
    const stage = STAGES.find(s => s.id === cab.stageId);
    if (!stage) return;

    const currentPos = get().driverPositions[cabId];
    const currentProgress = currentPos?.routeProgress ?? 0;

    // Advance progress by a small increment (simulates 15s of driving)
    const increment = 0.02 + Math.random() * 0.01;
    const newProgress = Math.min(0.95, currentProgress + increment); // cap at 95% so it never "arrives" in sim

    const newPos = computeDriverPosition(cabId, stage, cab.direction, newProgress);
    set({
      driverPositions: { ...get().driverPositions, [cabId]: newPos },
    });
  },

  startGpsSimulation: (cabId) => {
    // Stop any existing simulation
    if (gpsInterval) clearInterval(gpsInterval);
    // Initialize position at progress 0
    const cab = get().cabs.find(c => c.id === cabId);
    if (!cab) return;
    const stage = STAGES.find(s => s.id === cab.stageId);
    if (!stage) return;
    const initialPos = computeDriverPosition(cabId, stage, cab.direction, 0);
    set({ driverPositions: { ...get().driverPositions, [cabId]: initialPos } });
    // Update every 3 seconds (prototype speed; production would be 15s)
    gpsInterval = setInterval(() => {
      get().updateDriverPosition(cabId);
    }, 3000);
  },

  stopGpsSimulation: () => {
    if (gpsInterval) {
      clearInterval(gpsInterval);
      gpsInterval = null;
    }
  },

  setPassengerDirection: (d) => {
    const trainId = d === 'inbound' ? 't-dep-2' : 't-arr-2';
    set({ passengerDirection: d, selectedTrainId: trainId, selectedStageId: null });
  },
  setSelectedDate: (d) => set({ selectedDate: d }),
  setSelectedTrainId: (id) => set({ selectedTrainId: id, selectedStageId: null }),
  setSelectedStageId: (id) => set({ selectedStageId: id }),
  setPickupKind: (k) => set({ pickupKind: k }),
  setOffStageDistanceKm: (km) => set({ offStageDistanceKm: km }),
  setBookingKind: (k) => set({ bookingKind: k, ...(k === 'charter' ? { seatsRequested: 0 } : { seatsRequested: 1 }) }),
  setSeatsRequested: (n) => set({ seatsRequested: Math.max(1, Math.min(14, n)) }),

  bookSeat: (cabId, passengerName, pickupPoint, hasTicket) => {
    const state = get();
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return null;
    if (cab.charterLocked) return null;
    const seatsRequested = state.seatsRequested;
    if (cab.bookedSeats + seatsRequested > cab.capacity) return null;

    const stage = STAGES.find(s => s.id === cab.stageId)!;
    const fare = computeFare({
      settings: state.settings,
      pickupKind: state.pickupKind,
      offStageDistanceKm: state.pickupKind === 'off-stage' ? state.offStageDistanceKm : undefined,
      kind: 'pooled',
      capacity: cab.capacity,
    });

    const bookingId = `b-${++bookingCounter}`;
    const newBooking: Booking = {
      id: bookingId,
      cabId,
      passengerName,
      pickupPoint,
      pickupKind: state.pickupKind,
      stageId: cab.stageId,
      offStageDistanceKm: state.pickupKind === 'off-stage' ? state.offStageDistanceKm : undefined,
      hasTicket,
      direction: cab.direction,
      status: 'reserved',
      kind: 'pooled',
      seatsReserved: seatsRequested,
      farePaid: fare.perSeat * seatsRequested,
      createdAt: Date.now(),
      isMine: true,
    };

    set({
      bookings: [...state.bookings, newBooking],
      cabs: state.cabs.map(c =>
        c.id === cabId ? { ...c, bookedSeats: c.bookedSeats + seatsRequested } : c,
      ),
    });

    // Recompute fare nudge after booking
    const updated = get().cabs.find(c => c.id === cabId);
    if (updated) {
      const train = TRAINS.find(t => t.id === updated.trainId)!;
      const timing = computeTripTiming(updated, stage, train, state.settings, hasTicket, undefined, get().selectedDate);
      const newFare = nudgeFare(updated, timing, state.settings);
      if (newFare !== updated.currentFare) {
        set({
          cabs: get().cabs.map(c =>
            c.id === cabId ? { ...c, currentFare: newFare } : c,
          ),
        });
      }
    }
    return bookingId;
  },

  bookCharter: (cabId, passengerName, pickupPoint, hasTicket) => {
    const state = get();
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return null;
    if (cab.charterLocked) return null;
    // Charter requires empty cab (no pooled bookings)
    const check = canDriverAcceptCharter(cab, state.bookings);
    if (!check.allowed) return null;

    const fare = computeFare({
      settings: state.settings,
      pickupKind: state.pickupKind,
      offStageDistanceKm: state.pickupKind === 'off-stage' ? state.offStageDistanceKm : undefined,
      kind: 'charter',
      capacity: cab.capacity,
    });

    const bookingId = `b-${++bookingCounter}`;
    const newBooking: Booking = {
      id: bookingId,
      cabId,
      passengerName,
      pickupPoint,
      pickupKind: state.pickupKind,
      stageId: cab.stageId,
      offStageDistanceKm: state.pickupKind === 'off-stage' ? state.offStageDistanceKm : undefined,
      hasTicket,
      direction: cab.direction,
      status: 'reserved',
      kind: 'charter',
      seatsReserved: cab.capacity,
      farePaid: fare.total,
      createdAt: Date.now(),
      isMine: true,
    };

    set({
      bookings: [...state.bookings, newBooking],
      cabs: state.cabs.map(c =>
        c.id === cabId
          ? { ...c, charterLocked: true, bookedSeats: c.capacity }
          : c,
      ),
    });
    return bookingId;
  },

  cancelBooking: (bookingId) => {
    const state = get();
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    const cab = state.cabs.find(c => c.id === booking.cabId);
    if (!cab) return;

    const wasCharter = booking.kind === 'charter';
    const seats = booking.seatsReserved;
    set({
      bookings: state.bookings.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled' as const } : b,
      ),
      cabs: state.cabs.map(c => {
        if (c.id !== booking.cabId) return c;
        if (wasCharter) {
          return { ...c, charterLocked: false, bookedSeats: 0 };
        }
        return { ...c, bookedSeats: Math.max(0, c.bookedSeats - seats) };
      }),
    });
  },

  acceptRequest: (requestId, cabId) => {
    const state = get();
    const req = state.requests.find(r => r.id === requestId);
    if (!req) return;
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return;
    if (cab.charterLocked) return;

    const fare = computeFare({
      settings: state.settings,
      pickupKind: req.pickupKind,
      offStageDistanceKm: req.offStageDistanceKm,
      kind: 'pooled',
      capacity: cab.capacity,
    });

    const newBookings: Booking[] = [];
    for (let i = 0; i < req.seatsRequested; i++) {
      if (cab.bookedSeats + i >= cab.capacity) break;
      newBookings.push({
        id: `b-${++bookingCounter}`,
        cabId,
        passengerName: i === 0 ? req.passengerName : `${req.passengerName} +${i}`,
        pickupPoint: req.pickupPoint,
        pickupKind: req.pickupKind,
        stageId: req.stageId || cab.stageId,
        offStageDistanceKm: req.offStageDistanceKm,
        hasTicket: req.hasTicket,
        direction: cab.direction,
        status: 'reserved',
        kind: 'pooled',
        seatsReserved: 1,
        farePaid: fare.perSeat,
        createdAt: Date.now(),
      });
    }

    set({
      requests: state.requests.map(r =>
        r.id === requestId ? { ...r, status: 'accepted' as const } : r,
      ),
      bookings: [...state.bookings, ...newBookings],
      cabs: state.cabs.map(c =>
        c.id === cabId
          ? { ...c, bookedSeats: Math.min(c.capacity, c.bookedSeats + newBookings.length) }
          : c,
      ),
    });
  },

  acceptCharterRequest: (requestId, cabId) => {
    const state = get();
    const req = state.requests.find(r => r.id === requestId);
    if (!req || req.kind !== 'charter') return;
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return;

    const check = canDriverAcceptCharter(cab, state.bookings);
    if (!check.allowed) return;

    const fare = computeFare({
      settings: state.settings,
      pickupKind: req.pickupKind,
      offStageDistanceKm: req.offStageDistanceKm,
      kind: 'charter',
      capacity: cab.capacity,
    });

    const newBooking: Booking = {
      id: `b-${++bookingCounter}`,
      cabId,
      passengerName: req.passengerName,
      pickupPoint: req.pickupPoint,
      pickupKind: req.pickupKind,
      stageId: req.stageId || cab.stageId,
      offStageDistanceKm: req.offStageDistanceKm,
      hasTicket: req.hasTicket,
      direction: cab.direction,
      status: 'reserved',
      kind: 'charter',
      seatsReserved: cab.capacity,
      farePaid: fare.total,
      createdAt: Date.now(),
    };

    set({
      requests: state.requests.map(r =>
        r.id === requestId ? { ...r, status: 'accepted' as const } : r,
      ),
      bookings: [...state.bookings, newBooking],
      cabs: state.cabs.map(c =>
        c.id === cabId
          ? { ...c, charterLocked: true, bookedSeats: c.capacity }
          : c,
      ),
    });
  },

  declineRequest: (requestId) => {
    set({
      requests: get().requests.map(r =>
        r.id === requestId ? { ...r, status: 'declined' as const } : r,
      ),
    });
  },

  startTrip: (cabId) => {
    const state = get();
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return;
    const isCharter = cab.charterLocked;

    set({
      cabs: state.cabs.map(c =>
        c.id === cabId ? { ...c, status: 'departed' as const, departedAt: Date.now() } : c,
      ),
      bookings: state.bookings.map(b =>
        b.cabId === cabId ? { ...b, status: 'confirmed' as const } : b,
      ),
      driverStats: {
        ...state.driverStats,
        tripsCompleted: state.driverStats.tripsCompleted + 1,
        seatsFilled: state.driverStats.seatsFilled + cab.bookedSeats,
        seatsOffered: state.driverStats.seatsOffered + cab.capacity,
        chartersCompleted: state.driverStats.chartersCompleted + (isCharter ? 1 : 0),
        todayEarningsKSh: state.driverStats.todayEarningsKSh +
          state.bookings
            .filter(b => b.cabId === cabId && b.status !== 'cancelled')
            .reduce((sum, b) => sum + b.farePaid, 0),
      },
    });
  },

  assignCabToStage: (cabId, stageId) => {
    set({
      cabs: get().cabs.map(c =>
        c.id === cabId ? { ...c, stageId } : c,
      ),
    });
  },

  autoAssign: (trainId) => {
    const state = get();
    const train = TRAINS.find(t => t.id === trainId);
    if (!train) return { assigned: 0, unassigned: 0, details: ['Train not found'] };

    // Gather unassigned bookings for this train (matching direction)
    const unassigned = state.bookings.filter(b =>
      !b.cabId &&
      b.status !== 'cancelled' &&
      b.direction === train.direction
    );

    if (unassigned.length === 0) {
      return { assigned: 0, unassigned: 0, details: ['No unassigned bookings for this train'] };
    }

    // Gather available cabs for this train
    const availableCabs = state.cabs.filter(c =>
      c.trainId === trainId &&
      c.status === 'filling' &&
      !c.charterLocked &&
      (c.capacity - c.bookedSeats) > 0
    );

    if (availableCabs.length === 0) {
      return { assigned: 0, unassigned: unassigned.length, details: ['No available cabs'] };
    }

    // Sort bookings by seatsRequested DESC (pack big groups first)
    const sortedBookings = [...unassigned].sort((a, b) => b.seatsReserved - a.seatsReserved);

    // Build a working copy of cab loads
    const cabLoads = new Map<string, number>();
    availableCabs.forEach(c => cabLoads.set(c.id, c.bookedSeats));

    // Track assignment count per driver for fairness (recency penalty)
    const driverAssignmentCount = new Map<string, number>();
    availableCabs.forEach(c => driverAssignmentCount.set(c.driverName, 0));

    const details: string[] = [];
    let assignedCount = 0;
    let stillUnassigned = 0;

    // Update bookings and cabs
    const newBookings = [...state.bookings];
    const newCabs = [...state.cabs];
    const now = Date.now();

    for (const booking of sortedBookings) {
      // Compute fairness score for each cab and sort
      const scoredCabs = availableCabs
        .map(cab => {
          const currentLoad = cabLoads.get(cab.id) ?? cab.bookedSeats;
          const remaining = cab.capacity - currentLoad;
          const recentAssignments = driverAssignmentCount.get(cab.driverName) ?? 0;
          // Fairness score: lower = assign first
          // - currentLoad: emptier cabs first (load balancing)
          // - recentAssignments * 2: recency penalty
          // - rating * 0.5: small rating bonus (negative = preferred)
          const score = currentLoad + (recentAssignments * 2) - (cab.driverRating * 0.5);
          return { cab, remaining, score };
        })
        .filter(s => s.remaining >= booking.seatsReserved)
        .sort((a, b) => a.score - b.score);

      if (scoredCabs.length === 0) {
        // No cab can fit this booking
        stillUnassigned++;
        details.push(`⚠ ${booking.passengerName} (${booking.seatsReserved} seats) — no cab with enough capacity`);
        continue;
      }

      const chosen = scoredCabs[0];
      const cab = chosen.cab;

      // Update booking
      const bookingIdx = newBookings.findIndex(b => b.id === booking.id);
      if (bookingIdx >= 0) {
        newBookings[bookingIdx] = {
          ...newBookings[bookingIdx],
          cabId: cab.id,
          assignedAt: now,
        };
      }

      // Update cab load
      const newLoad = (cabLoads.get(cab.id) ?? cab.bookedSeats) + booking.seatsReserved;
      cabLoads.set(cab.id, newLoad);

      // Update driver recency
      driverAssignmentCount.set(cab.driverName, (driverAssignmentCount.get(cab.driverName) ?? 0) + 1);

      // Update cab in newCabs
      const cabIdx = newCabs.findIndex(c => c.id === cab.id);
      if (cabIdx >= 0) {
        newCabs[cabIdx] = { ...newCabs[cabIdx], bookedSeats: newLoad };
      }

      assignedCount++;
      details.push(`✓ ${booking.passengerName} (${booking.seatsReserved} seat${booking.seatsReserved > 1 ? 's' : ''}) → ${cab.driverName}'s ${cab.cabType} [${cab.plateNumber}]`);
    }

    set({ bookings: newBookings, cabs: newCabs });

    return { assigned: assignedCount, unassigned: stillUnassigned, details };
  },

  getCab: (id) => get().cabs.find(c => c.id === id),
  getStage: (id) => STAGES.find(s => s.id === id),
  getTrain: (id) => TRAINS.find(t => t.id === id),
  getCabsForTrain: (trainId) => get().cabs.filter(c => c.trainId === trainId && c.direction === 'inbound'),
  getCabsForStage: (stageId, direction) =>
    get().cabs.filter(c => c.stageId === stageId && c.direction === direction),
  getBookingsForCab: (cabId) => get().bookings.filter(b => b.cabId === cabId && b.status !== 'cancelled'),
  getRequestsForDriver: (cabId) => {
    const cab = get().cabs.find(c => c.id === cabId);
    if (!cab) return [];
    if (cab.charterLocked) return []; // pooled requests hidden when charter locked
    return get().requests.filter(r =>
      r.status === 'pending' &&
      r.kind === 'pooled' &&
      r.direction === cab.direction,
    );
  },
  getCharterRequestsForDriver: (cabId) => {
    const cab = get().cabs.find(c => c.id === cabId);
    if (!cab) return [];
    if (cab.charterLocked) return [];
    const check = canDriverAcceptCharter(cab, get().bookings);
    if (!check.allowed) return [];
    return get().requests.filter(r =>
      r.status === 'pending' &&
      r.kind === 'charter' &&
      r.direction === cab.direction,
    );
  },
  getPassengersWaitingAtStage: (stageId) => {
    // Passengers with pending requests at this stage
    const reqCount = get().requests
      .filter(r => r.status === 'pending' && r.stageId === stageId)
      .reduce((sum, r) => sum + r.seatsRequested, 0);
    return reqCount;
  },
}));
