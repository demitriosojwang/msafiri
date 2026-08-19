// Seed data for the SGR Feeder prototype.
// All routes/cabs/trains reflect real Mombasa-area geography around the SGR Mombasa Terminus (Miritini).

import type { Cab, PickupRequest, Route, Settings, Train, Booking, DriverStats } from './types';

export const SETTINGS: Settings = {
  securityBufferMin: 15,
  ticketingBufferMin: 20,
  checkInBufferMin: 10,
  minFillThreshold: 0.7,    // 70% of seats must be booked to lock departure
  lockCutoffMin: 30,        // lock 30 min before latestLeaveTime
  nudgeDiscountPct: 10,
  nudgeWindowMin: 60,       // within 60 min of cutoff, drop fare to fill last seats
};

// Inbound routes: pickup zones scattered around Mombasa → Mombasa Terminus (Miritini)
// Outbound routes: from Terminus → scattered destinations (same geography, mirrored)
export const ROUTES: Route[] = [
  { id: 'r-jomvu',   name: 'Jomvu',   zone: 'inbound',  travelMin: 35, peakAdjustMin: 15, baseFare: 300, landmark: 'Jomvu Shopping Centre' },
  { id: 'r-miritini',name: 'Miritini',zone: 'inbound',  travelMin: 15, peakAdjustMin: 5,  baseFare: 150, landmark: 'Miritini Junction' },
  { id: 'r-shanzu',  name: 'Shanzu',  zone: 'inbound',  travelMin: 45, peakAdjustMin: 20, baseFare: 400, landmark: 'Shanzu Stage' },
  { id: 'r-bamburi', name: 'Bamburi', zone: 'inbound',  travelMin: 50, peakAdjustMin: 20, baseFare: 450, landmark: 'Bamburi Mtamu' },
  { id: 'r-nyali',   name: 'Nyali',   zone: 'inbound',  travelMin: 40, peakAdjustMin: 15, baseFare: 400, landmark: 'Nyali City Mall' },
  { id: 'r-cbd',     name: 'CBD',     zone: 'inbound',  travelMin: 30, peakAdjustMin: 10, baseFare: 300, landmark: 'Digo Road Stage' },

  { id: 'o-jomvu',   name: 'Jomvu',   zone: 'outbound', travelMin: 35, peakAdjustMin: 15, baseFare: 300, landmark: 'Jomvu Shopping Centre' },
  { id: 'o-miritini',name: 'Miritini',zone: 'outbound', travelMin: 15, peakAdjustMin: 5,  baseFare: 150, landmark: 'Miritini Junction' },
  { id: 'o-shanzu',  name: 'Shanzu',  zone: 'outbound', travelMin: 45, peakAdjustMin: 20, baseFare: 400, landmark: 'Shanzu Stage' },
  { id: 'o-bamburi', name: 'Bamburi', zone: 'outbound', travelMin: 50, peakAdjustMin: 20, baseFare: 450, landmark: 'Bamburi Mtamu' },
  { id: 'o-nyali',   name: 'Nyali',   zone: 'outbound', travelMin: 40, peakAdjustMin: 15, baseFare: 400, landmark: 'Nyali City Mall' },
  { id: 'o-cbd',     name: 'CBD',     zone: 'outbound', travelMin: 30, peakAdjustMin: 10, baseFare: 300, landmark: 'Digo Road Stage' },
];

// SGR Madaraka Express — Mombasa → Nairobi departures (real timetable, simplified)
export const TRAINS: Train[] = [
  { id: 't-1', code: 'SGR 01', departureTime: '08:00', destination: 'Nairobi', origin: 'Mombasa Terminus' },
  { id: 't-2', code: 'SGR 03', departureTime: '15:00', destination: 'Nairobi', origin: 'Mombasa Terminus' },
  { id: 't-3', code: 'SGR 05', departureTime: '18:00', destination: 'Nairobi', origin: 'Mombasa Terminus' },
];

// Simulated "now" — fixed for deterministic prototype.
// Set to 13:00 so the 15:00 train is the live one (passengers booking ahead, cabs filling).
export const SIM_NOW = (() => {
  const d = new Date();
  d.setHours(13, 0, 0, 0);
  return d.getTime();
})();

// Helper: today at HH:MM as epoch ms
export function atTime(hhmm: string, dayOffset = 0): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// Seed inbound cabs — drivers posting trips tied to specific trains
export const SEED_CABS: Cab[] = [
  // 15:00 train (live, filling now)
  cab('c1', 'Mwangi',  4.8, 'KDA 234X', '4-seater',  4,  'r-nyali',   't-2', 'inbound', 2, 'filling'),
  cab('c2', 'Amani',   4.9, 'KDB 881P', '7-seater',  7,  'r-jomvu',   't-2', 'inbound', 5, 'filling'),
  cab('c3', 'Halima',  4.7, 'KDC 552L', '14-seater', 14, 'r-bamburi', 't-2', 'inbound', 9, 'filling'),
  cab('c4', 'Joseph',  4.6, 'KDE 119M', '11-seater', 11, 'r-cbd',     't-2', 'inbound', 6, 'filling'),
  cab('c5', 'Fatuma',  4.9, 'KDF 770Q', '4-seater',  4,  'r-shanzu',  't-2', 'inbound', 1, 'filling'),

  // 18:00 train (later, pre-bookable)
  cab('c6', 'Brian',   4.5, 'KDG 332R', '7-seater',  7,  'r-nyali',   't-3', 'inbound', 3, 'filling'),
  cab('c7', 'Wanjiru', 4.8, 'KDH 908T', '11-seater', 11, 'r-jomvu',   't-3', 'inbound', 4, 'filling'),
  cab('c8', 'Omar',    4.7, 'KDJ 441V', '14-seater', 14, 'r-bamburi', 't-3', 'inbound', 8, 'filling'),

  // Outbound cabs — positioned at terminus, waiting to pool arriving passengers
  // Trains arriving at Mombasa Terminus (mirrored schedule)
  cab('o1', 'Mwangi',  4.8, 'KDA 234X', '4-seater',  4,  'o-nyali',   't-2', 'outbound', 0, 'filling'),
  cab('o2', 'Amani',   4.9, 'KDB 881P', '7-seater',  7,  'o-cbd',     't-2', 'outbound', 2, 'filling'),
  cab('o3', 'Halima',  4.7, 'KDC 552L', '14-seater', 14, 'o-bamburi', 't-3', 'outbound', 5, 'filling'),
  cab('o4', 'Joseph',  4.6, 'KDE 119M', '11-seater', 11, 'o-jomvu',   't-3', 'outbound', 3, 'filling'),
];

function cab(
  id: string,
  driverName: string,
  driverRating: number,
  plateNumber: string,
  cabType: Cab['cabType'],
  capacity: number,
  routeId: string,
  trainId: string,
  direction: 'inbound' | 'outbound',
  bookedSeats: number,
  status: Cab['status'],
): Cab {
  const route = ROUTES.find(r => r.id === routeId)!;
  return {
    id, driverName, driverRating, plateNumber, cabType, capacity,
    routeId, trainId, direction, bookedSeats, status,
    baseFare: route.baseFare,
    currentFare: route.baseFare,
  };
}

export const SEED_REQUESTS: PickupRequest[] = [
  {
    id: 'rq1',
    passengerName: 'Grace W.',
    pickupPoint: 'Nyali City Mall',
    destinationZoneId: undefined,
    seatsRequested: 1,
    trainId: 't-2',
    hasTicket: true,
    direction: 'inbound',
    createdAt: SIM_NOW - 1000 * 60 * 5,
    status: 'pending',
  },
  {
    id: 'rq2',
    passengerName: 'Said A.',
    pickupPoint: 'Bamburi Mtamu',
    seatsRequested: 2,
    trainId: 't-2',
    hasTicket: false,
    direction: 'inbound',
    createdAt: SIM_NOW - 1000 * 60 * 3,
    status: 'pending',
  },
  {
    id: 'rq3',
    passengerName: 'Mercy K.',
    pickupPoint: 'Jomvu Shopping Centre',
    seatsRequested: 1,
    trainId: 't-3',
    hasTicket: true,
    direction: 'inbound',
    createdAt: SIM_NOW - 1000 * 60 * 8,
    status: 'pending',
  },
];

export const SEED_BOOKINGS: Booking[] = [
  // Reflects the bookedSeats counts in SEED_CABS — pre-existing reservations
  booking('b1', 'c1', 'Passenger A', 'Nyali City Mall', true,  'inbound'),
  booking('b2', 'c1', 'Passenger B', 'Nyali City Mall', false, 'inbound'),
  booking('b3', 'c2', 'Passenger C', 'Jomvu Stage',     true,  'inbound'),
  booking('b4', 'c2', 'Passenger D', 'Jomvu Stage',     true,  'inbound'),
  booking('b5', 'c2', 'Passenger E', 'Jomvu Stage',     false, 'inbound'),
  booking('b6', 'c2', 'Passenger F', 'Jomvu Stage',     true,  'inbound'),
  booking('b7', 'c2', 'Passenger G', 'Jomvu Stage',     true,  'inbound'),
  booking('b8', 'c3', 'Passenger H', 'Bamburi Mtamu',   false, 'inbound'),
  booking('b9', 'c4', 'Passenger I', 'Digo Road',       true,  'inbound'),
];

function booking(id: string, cabId: string, passengerName: string, pickupPoint: string, hasTicket: boolean, direction: 'inbound' | 'outbound'): Booking {
  return {
    id, cabId, passengerName, pickupPoint, hasTicket, direction,
    status: 'reserved', createdAt: SIM_NOW - 1000 * 60 * 30,
  };
}

export const DRIVER_STATS: DriverStats = {
  todayEarningsKSh: 2450,
  tripsCompleted: 2,
  seatsFilled: 9,
  seatsOffered: 11,
  rating: 4.8,
};

// Logged-in driver perspective — Mwangi (drives c1 inbound + o1 outbound)
export const ACTIVE_DRIVER_ID = 'c1';
