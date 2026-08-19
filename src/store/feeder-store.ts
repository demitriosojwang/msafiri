'use client';

import { create } from 'zustand';
import type { Booking, Cab, PickupRequest, Settings } from '@/lib/feeder/types';
import {
  DRIVER_STATS,
  ROUTES,
  SEED_BOOKINGS,
  SEED_CABS,
  SEED_REQUESTS,
  SETTINGS,
  TRAINS,
  ACTIVE_DRIVER_ID,
} from '@/lib/feeder/seed';
import { computeTripTiming, nudgeFare } from '@/lib/feeder/calc';

export type Role = 'passenger' | 'driver';
export type PassengerDirection = 'inbound' | 'outbound';

interface FeederState {
  role: Role;
  settings: Settings;
  cabs: Cab[];
  bookings: Booking[];
  requests: PickupRequest[];
  // Passenger view state
  passengerDirection: PassengerDirection;
  selectedTrainId: string;
  selectedOutboundZoneId: string | null;
  // Driver view state
  activeDriverCabId: string;
  driverStats: typeof DRIVER_STATS;

  // Actions
  setRole: (r: Role) => void;
  setPassengerDirection: (d: PassengerDirection) => void;
  setSelectedTrainId: (id: string) => void;
  setSelectedOutboundZoneId: (id: string | null) => void;

  bookSeat: (cabId: string, passengerName: string, pickupPoint: string, hasTicket: boolean, destinationZoneId?: string) => string | null;
  cancelBooking: (bookingId: string) => void;
  acceptRequest: (requestId: string, cabId: string) => void;
  declineRequest: (requestId: string) => void;
  startTrip: (cabId: string) => void;

  // Selectors
  getCab: (id: string) => Cab | undefined;
  getCabsForTrain: (trainId: string) => Cab[];
  getCabsForOutboundZone: (zoneId: string) => Cab[];
  getBookingsForCab: (cabId: string) => Booking[];
  getRequestsForDriver: (cabId: string) => PickupRequest[];
}

let bookingCounter = 100;
let requestCounter = 100;

export const useFeederStore = create<FeederState>((set, get) => ({
  role: 'passenger',
  settings: SETTINGS,
  cabs: SEED_CABS,
  bookings: SEED_BOOKINGS,
  requests: SEED_REQUESTS,
  passengerDirection: 'inbound',
  selectedTrainId: 't-2',           // 15:00 train — live one
  selectedOutboundZoneId: null,
  activeDriverCabId: ACTIVE_DRIVER_ID,
  driverStats: DRIVER_STATS,

  setRole: (r) => set({ role: r }),
  setPassengerDirection: (d) => set({ passengerDirection: d }),
  setSelectedTrainId: (id) => set({ selectedTrainId: id }),
  setSelectedOutboundZoneId: (id) => set({ selectedOutboundZoneId: id }),

  bookSeat: (cabId, passengerName, pickupPoint, hasTicket, destinationZoneId) => {
    const state = get();
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return null;
    if (cab.bookedSeats >= cab.capacity) return null;

    const bookingId = `b-${++bookingCounter}`;
    const newBooking: Booking = {
      id: bookingId,
      cabId,
      passengerName,
      pickupPoint,
      hasTicket,
      direction: cab.direction,
      status: 'reserved',
      createdAt: Date.now(),
      destinationZoneId,
      isMine: true,
    };

    set({
      bookings: [...state.bookings, newBooking],
      cabs: state.cabs.map(c =>
        c.id === cabId ? { ...c, bookedSeats: c.bookedSeats + 1 } : c,
      ),
    });

    // Recompute fare nudge after booking
    const updated = get().cabs.find(c => c.id === cabId);
    if (updated) {
      const route = ROUTES.find(r => r.id === updated.routeId)!;
      const train = TRAINS.find(t => t.id === updated.trainId)!;
      const timing = computeTripTiming(updated, route, train, state.settings, hasTicket);
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

  cancelBooking: (bookingId) => {
    const state = get();
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    set({
      bookings: state.bookings.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled' as const } : b,
      ),
      cabs: state.cabs.map(c =>
        c.id === booking.cabId ? { ...c, bookedSeats: Math.max(0, c.bookedSeats - 1) } : c,
      ),
    });
  },

  acceptRequest: (requestId, cabId) => {
    const state = get();
    const req = state.requests.find(r => r.id === requestId);
    if (!req) return;
    const cab = state.cabs.find(c => c.id === cabId);
    if (!cab) return;

    // Add bookings for the requested seats
    const newBookings: Booking[] = [];
    for (let i = 0; i < req.seatsRequested; i++) {
      if (cab.bookedSeats + i >= cab.capacity) break;
      newBookings.push({
        id: `b-${++bookingCounter}`,
        cabId,
        passengerName: i === 0 ? req.passengerName : `${req.passengerName} +${i}`,
        pickupPoint: req.pickupPoint,
        hasTicket: req.hasTicket,
        direction: cab.direction,
        status: 'reserved',
        createdAt: Date.now(),
        destinationZoneId: req.destinationZoneId,
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

    set({
      cabs: state.cabs.map(c =>
        c.id === cabId ? { ...c, status: 'departed' as const, departedAt: Date.now() } : c,
      ),
      bookings: state.bookings.map(b =>
        b.cabId === cabId ? { ...b, status: 'confirmed' as const } : b,
      ),
      // Bump driver stats
      driverStats: {
        ...state.driverStats,
        tripsCompleted: state.driverStats.tripsCompleted + 1,
        seatsFilled: state.driverStats.seatsFilled + cab.bookedSeats,
        seatsOffered: state.driverStats.seatsOffered + cab.capacity,
        todayEarningsKSh: state.driverStats.todayEarningsKSh + (cab.currentFare * cab.bookedSeats),
      },
    });
  },

  getCab: (id) => get().cabs.find(c => c.id === id),
  getCabsForTrain: (trainId) => get().cabs.filter(c => c.trainId === trainId && c.direction === 'inbound'),
  getCabsForOutboundZone: (zoneId) => get().cabs.filter(c => c.routeId === zoneId && c.direction === 'outbound'),
  getBookingsForCab: (cabId) => get().bookings.filter(b => b.cabId === cabId && b.status !== 'cancelled'),
  getRequestsForDriver: (cabId) => {
    const cab = get().cabs.find(c => c.id === cabId);
    if (!cab) return [];
    return get().requests.filter(r => r.status === 'pending' && r.direction === cab.direction);
  },
}));
