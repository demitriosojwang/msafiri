// Seed data for the SGR Feeder prototype (v2).
// Reflects the actual agreed stages — existing SGR waiting/collection points used as
// pickup/drop-off points. South Coast (Likoni, Kombani, Ukunda) + North Coast (Bamburi, Mtwapa, Malindi).
//
// Trains:
//   Departures (Mombasa → Nairobi): 08:00, 15:00, 22:00  (Madaraka Express)
//   Arrivals   (Nairobi → Mombasa): 04:00, 14:00, 20:30

import type { Cab, PickupRequest, Settings, Stage, Train, Booking, DriverStats } from './types';

export const SETTINGS: Settings = {
  securityBufferMin: 15,
  ticketingBufferMin: 20,
  checkInBufferMin: 10,
  minFillThreshold: 0.7,
  lockCutoffMin: 30,
  nudgeDiscountPct: 10,
  nudgeWindowMin: 60,
  // Fare model — user spec
  baseFareStage: 450,             // KSh 450 base for stage pickup
  offStageSurchargePerKm: 50,     // +KSh 50 per km beyond the stage
  offStageMaxRadiusKm: 3,         // beyond 3km → "meet at nearest stage"
  charterMultiplier: 1.3,         // charter = base × capacity × 1.3
};

// Stages — the agreed SGR waiting/collection points.
// Coordinates are approximate real GPS positions around Mombasa for live tracking simulation.
// Mombasa Terminus (Miritini) is at approximately -4.0250, 39.5950
export const STAGES: Stage[] = [
  // --- SOUTH COAST: Likoni cluster ---
  { id: 's-likoni-ferry',  name: 'Likoni Ferry Container', area: 'Likoni', coast: 'south', travelMin: 35, peakAdjustMin: 15, landmark: 'Main SGR collection point, Likoni', lat: -4.0710, lng: 39.6660 },
  { id: 's-fayaz',         name: 'Fayaz (Kona Mpya)',      area: 'Likoni', coast: 'south', travelMin: 38, peakAdjustMin: 15, landmark: 'Kona Mpya junction', lat: -4.0780, lng: 39.6720 },
  { id: 's-shikaadabu',    name: 'ShikaAdabu (Checkpoint)', area: 'Likoni', coast: 'south', travelMin: 42, peakAdjustMin: 20, landmark: 'Checkpoint stage', lat: -4.0850, lng: 39.6790 },

  // --- SOUTH COAST: Diani cluster ---
  { id: 's-kombani',       name: 'Kombani',                 area: 'Kombani', coast: 'south', travelMin: 50, peakAdjustMin: 20, landmark: 'Kombani junction', lat: -4.2430, lng: 39.5630 },
  { id: 's-naivas-diani',  name: 'Naivas Diani',            area: 'Ukunda',  coast: 'south', travelMin: 60, peakAdjustMin: 25, landmark: 'Naivas Diani supermarket', lat: -4.2780, lng: 39.5720 },

  // --- NORTH COAST ---
  { id: 's-kimbeni',       name: 'Kimbeni',                 area: 'Bamburi', coast: 'north', travelMin: 45, peakAdjustMin: 20, landmark: 'Kimbeni stage, Bamburi', lat: -3.9950, lng: 39.7180 },
  { id: 's-mtambo',        name: 'Mtambo',                  area: 'Bamburi', coast: 'north', travelMin: 48, peakAdjustMin: 20, landmark: 'Mtambo stage, Bamburi', lat: -3.9980, lng: 39.7250 },
  { id: 's-mtwapa',        name: 'Mtwapa',                  area: 'Mtwapa',  coast: 'north', travelMin: 55, peakAdjustMin: 25, landmark: 'Mtwapa town stage', lat: -3.9530, lng: 39.7440 },

  // North Coast stages further out — specific locations TBD by user
  { id: 's-malindi',       name: 'Malindi',                 area: 'Malindi', coast: 'north', travelMin: 120, peakAdjustMin: 30, landmark: 'Malindi town (location TBD)', lat: -3.9390, lng: 39.8490 },
];

// Mombasa Terminus GPS position (for route calculations)
export const TERMINUS_GPS = { lat: -4.0250, lng: 39.5950 };

// Trains — Madaraka Express (real schedule from Kenya Railways)
// MTM = Mombasa Terminus to Nairobi (departures)
// NTM = Nairobi Terminus to Mombasa (arrivals at Mombasa)
export const TRAINS: Train[] = [
  // MTM departures — passengers heading TO the terminus to catch these
  { id: 't-dep-1', code: 'Inter-County', time: '08:00', direction: 'inbound',  origin: 'Mombasa Terminus', destination: 'Nairobi' },
  { id: 't-dep-2', code: 'Express',      time: '15:00', direction: 'inbound',  origin: 'Mombasa Terminus', destination: 'Nairobi' },
  { id: 't-dep-3', code: 'Night Train',  time: '22:00', direction: 'inbound',  origin: 'Mombasa Terminus', destination: 'Nairobi' },

  // NTM arrivals — passengers OFFBOARDING at Mombasa, connecting to cabs home
  { id: 't-arr-1', code: 'Inter-County', time: '14:00', direction: 'outbound', origin: 'Nairobi', destination: 'Mombasa Terminus' },
  { id: 't-arr-2', code: 'Express',      time: '20:30', direction: 'outbound', origin: 'Nairobi', destination: 'Mombasa Terminus' },
  { id: 't-arr-3', code: 'Night Train',  time: '03:55', direction: 'outbound', origin: 'Nairobi', destination: 'Mombasa Terminus' },
];

export const TRAINS_BY_DIR = {
  inbound: TRAINS.filter(t => t.direction === 'inbound'),
  outbound: TRAINS.filter(t => t.direction === 'outbound'),
};

// Simulated "now" — fixed for deterministic prototype.
// Set to 13:00 so the 15:00 departure + 14:00 arrival are both "live".
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

// Helper: specific date (YYYY-MM-DD) at HH:MM as epoch ms
export function atTimeOnDate(hhmm: string, dateStr: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, da] = dateStr.split('-').map(Number);
  const d = new Date(y, mo - 1, da, h, m, 0, 0);
  return d.getTime();
}

// Today as YYYY-MM-DD
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

// Format a YYYY-MM-DD date for display: "Mon 19 Aug"
export function fmtDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${d} ${months[date.getMonth()]}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

export function isTomorrow(dateStr: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${da}`;
}

// Seed cabs — both inbound (filling for departures) and outbound (positioned for arrivals)
export const SEED_CABS: Cab[] = [
  // --- INBOUND: filling for the 15:00 departure ---
  inboundCab('c1', 'Mwangi',  4.8, 'KDA 234X', '4-seater',  4,  's-mtwapa',        't-dep-2', 2, 'filling'),
  inboundCab('c2', 'Amani',   4.9, 'KDB 881P', '7-seater',  7,  's-likoni-ferry',  't-dep-2', 5, 'filling'),
  inboundCab('c3', 'Halima',  4.7, 'KDC 552L', '14-seater', 14, 's-kimbeni',       't-dep-2', 9, 'filling'),
  inboundCab('c4', 'Joseph',  4.6, 'KDE 119M', '11-seater', 11, 's-naivas-diani',  't-dep-2', 6, 'filling'),
  inboundCab('c5', 'Fatuma',  4.9, 'KDF 770Q', '4-seater',  4,  's-malindi',       't-dep-2', 1, 'filling'),

  // --- INBOUND: filling for the 22:00 departure ---
  inboundCab('c6', 'Brian',   4.5, 'KDG 332R', '7-seater',  7,  's-mtwapa',        't-dep-3', 3, 'filling'),
  inboundCab('c7', 'Wanjiru', 4.8, 'KDH 908T', '11-seater', 11, 's-likoni-ferry',  't-dep-3', 4, 'filling'),
  inboundCab('c8', 'Omar',    4.7, 'KDJ 441V', '14-seater', 14, 's-kimbeni',       't-dep-3', 8, 'filling'),
  // Empty 4-seater for the 22:00 departure — available for charter demo
  inboundCab('c9', 'Patrick', 4.9, 'KDK 012W', '4-seater',  4,  's-naivas-diani',  't-dep-3', 0, 'filling'),

  // --- OUTBOUND: positioned at terminus for arrivals (14:00 train) ---
  // The driver who drove inbound to the terminus now positions to pick up arriving passengers.
  // Coverage gap: Fayaz and ShikaAdabu (Likoni cluster) have passengers waiting but NO cab assigned.
  outboundCab('o1', 'Mwangi',  4.8, 'KDA 234X', '4-seater',  4,  's-mtwapa',        't-arr-2', 0, 'filling'),
  outboundCab('o2', 'Amani',   4.9, 'KDB 881P', '7-seater',  7,  's-likoni-ferry',  't-arr-2', 2, 'filling'),
  outboundCab('o3', 'Halima',  4.7, 'KDC 552L', '14-seater', 14, 's-kimbeni',       't-arr-2', 5, 'filling'),
  outboundCab('o4', 'Joseph',  4.6, 'KDE 119M', '11-seater', 11, 's-naivas-diani',  't-arr-2', 3, 'filling'),

  // --- OUTBOUND: positioned for 20:30 arrival ---
  outboundCab('o5', 'Brian',   4.5, 'KDG 332R', '7-seater',  7,  's-mtwapa',        't-arr-3', 0, 'filling'),
  outboundCab('o6', 'Wanjiru', 4.8, 'KDH 908T', '11-seater', 11, 's-likoni-ferry',  't-arr-3', 2, 'filling'),
  outboundCab('o7', 'Patrick', 4.9, 'KDK 012W', '4-seater',  4,  's-naivas-diani',  't-arr-3', 0, 'filling'),
];

function inboundCab(
  id: string, driverName: string, driverRating: number, plateNumber: string,
  cabType: Cab['cabType'], capacity: number, stageId: string, trainId: string,
  bookedSeats: number, status: Cab['status'],
): Cab {
  return {
    id, driverName, driverRating, plateNumber, cabType, capacity,
    stageId, trainId, direction: 'inbound', bookedSeats, status,
    baseFare: SETTINGS.baseFareStage,
    currentFare: SETTINGS.baseFareStage,
    charterLocked: false,
  };
}

function outboundCab(
  id: string, driverName: string, driverRating: number, plateNumber: string,
  cabType: Cab['cabType'], capacity: number, stageId: string, trainId: string,
  bookedSeats: number, status: Cab['status'],
): Cab {
  return {
    id, driverName, driverRating, plateNumber, cabType, capacity,
    stageId, trainId, direction: 'outbound', bookedSeats, status,
    baseFare: SETTINGS.baseFareStage,
    currentFare: SETTINGS.baseFareStage,
    charterLocked: false,
  };
}

// Seed requests — including charter requests for the driver-side demo
export const SEED_REQUESTS: PickupRequest[] = [
  // Inbound pooled requests
  {
    id: 'rq1', passengerName: 'Grace W.',
    pickupPoint: 'Mtwapa town stage', pickupKind: 'stage', stageId: 's-mtwapa',
    seatsRequested: 1, trainId: 't-dep-2', hasTicket: true, direction: 'inbound',
    kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 5, status: 'pending',
  },
  {
    id: 'rq2', passengerName: 'Said A.',
    pickupPoint: 'Kimbeni stage', pickupKind: 'stage', stageId: 's-kimbeni',
    seatsRequested: 2, trainId: 't-dep-2', hasTicket: false, direction: 'inbound',
    kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 3, status: 'pending',
  },
  // Inbound charter request — family booking whole 4-seater for 22:00 train
  {
    id: 'rq3', passengerName: 'The Khan Family',
    pickupPoint: 'Naivas Diani', pickupKind: 'stage', stageId: 's-naivas-diani',
    seatsRequested: 4, trainId: 't-dep-3', hasTicket: true, direction: 'inbound',
    kind: 'charter', createdAt: SIM_NOW - 1000 * 60 * 8, status: 'pending',
  },
  // Outbound pooled requests — arriving passengers
  {
    id: 'rq4', passengerName: 'Mercy K.',
    pickupPoint: 'Likoni Ferry Container', pickupKind: 'stage', stageId: 's-likoni-ferry',
    seatsRequested: 1, trainId: 't-arr-2', hasTicket: false, direction: 'outbound',
    kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 10, status: 'pending',
  },
  // Off-stage request (with distance surcharge)
  {
    id: 'rq5', passengerName: 'Brian O.',
    pickupPoint: 'Near Tuskys Bamburi', pickupKind: 'off-stage', stageId: 's-kimbeni',
    offStageDistanceKm: 2.4, seatsRequested: 1, trainId: 't-arr-2', hasTicket: true,
    direction: 'outbound', kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 6, status: 'pending',
  },
  // Outbound charter — private pickup for 20:30 arrival
  {
    id: 'rq6', passengerName: 'Mr. Patel',
    pickupPoint: 'Mtwapa town stage', pickupKind: 'stage', stageId: 's-mtwapa',
    seatsRequested: 7, trainId: 't-arr-3', hasTicket: true, direction: 'outbound',
    kind: 'charter', createdAt: SIM_NOW - 1000 * 60 * 12, status: 'pending',
  },
  // Coverage gap demonstration — Fayaz and ShikaAdabu have waiting passengers but no cab
  {
    id: 'rq7', passengerName: 'Hawa A.',
    pickupPoint: 'Fayaz (Kona Mpya)', pickupKind: 'stage', stageId: 's-fayaz',
    seatsRequested: 1, trainId: 't-arr-2', hasTicket: false, direction: 'outbound',
    kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 9, status: 'pending',
  },
  {
    id: 'rq8', passengerName: 'Ali M.',
    pickupPoint: 'ShikaAdabu (Checkpoint)', pickupKind: 'stage', stageId: 's-shikaadabu',
    seatsRequested: 2, trainId: 't-arr-2', hasTicket: true, direction: 'outbound',
    kind: 'pooled', createdAt: SIM_NOW - 1000 * 60 * 7, status: 'pending',
  },
];

// Seed bookings — pre-existing reservations reflecting the bookedSeats counts
export const SEED_BOOKINGS: Booking[] = [
  // Inbound for 15:00 (c1-c5)
  booking('b1', 'c1', 'Passenger A', 'Mtwapa town stage', 'stage', 's-mtwapa', undefined, true,  'inbound', 'pooled', 1, 450),
  booking('b2', 'c1', 'Passenger B', 'Mtwapa town stage', 'stage', 's-mtwapa', undefined, false, 'inbound', 'pooled', 1, 450),
  booking('b3', 'c2', 'Passenger C', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true,  'inbound', 'pooled', 1, 450),
  booking('b4', 'c2', 'Passenger D', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true,  'inbound', 'pooled', 1, 450),
  booking('b5', 'c2', 'Passenger E', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, false, 'inbound', 'pooled', 1, 450),
  booking('b6', 'c2', 'Passenger F', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true,  'inbound', 'pooled', 1, 450),
  booking('b7', 'c2', 'Passenger G', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true,  'inbound', 'pooled', 1, 450),
  booking('b8', 'c3', 'Passenger H', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, false, 'inbound', 'pooled', 1, 450),
  booking('b9', 'c4', 'Passenger I', 'Naivas Diani', 'stage', 's-naivas-diani', undefined, true, 'inbound', 'pooled', 1, 450),

  // Outbound for 14:00 arrival (o2-o4) — pre-existing pooled
  booking('b10', 'o2', 'Passenger J', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, false, 'outbound', 'pooled', 1, 450),
  booking('b11', 'o2', 'Passenger K', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b12', 'o3', 'Passenger L', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b13', 'o3', 'Passenger M', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, false, 'outbound', 'pooled', 1, 450),
  booking('b14', 'o3', 'Passenger N', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b15', 'o3', 'Passenger O', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, false, 'outbound', 'pooled', 1, 450),
  booking('b16', 'o3', 'Passenger P', 'Kimbeni stage', 'stage', 's-kimbeni', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b17', 'o4', 'Passenger Q', 'Naivas Diani', 'stage', 's-naivas-diani', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b18', 'o4', 'Passenger R', 'Naivas Diani', 'stage', 's-naivas-diani', undefined, true,  'outbound', 'pooled', 1, 450),
  booking('b19', 'o4', 'Passenger S', 'Naivas Diani', 'stage', 's-naivas-diani', undefined, false, 'outbound', 'pooled', 1, 450),

  // Outbound for 20:30 arrival (o5-o6)
  booking('b20', 'o6', 'Passenger T', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true, 'outbound', 'pooled', 1, 450),
  booking('b21', 'o6', 'Passenger U', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, false, 'outbound', 'pooled', 1, 450),
];

function booking(
  id: string, cabId: string | undefined, passengerName: string, pickupPoint: string,
  pickupKind: 'stage' | 'off-stage', stageId: string | undefined,
  offStageDistanceKm: number | undefined, hasTicket: boolean, direction: 'inbound' | 'outbound',
  kind: 'pooled' | 'charter', seatsReserved: number, farePaid: number,
  vehicleTypePreference?: '4-seater' | '7-seater' | '11-seater' | '14-seater',
): Booking {
  return {
    id, cabId, passengerName, pickupPoint, pickupKind, stageId,
    offStageDistanceKm, hasTicket, direction, status: 'reserved',
    kind, seatsReserved, farePaid,
    createdAt: SIM_NOW - 1000 * 60 * 30,
    vehicleTypePreference,
  };
}

// Unassigned bookings — passengers who booked a vehicle type but no specific cab.
// These are waiting for auto-assignment by the allocation engine.
export const SEED_UNASSIGNED: Booking[] = [
  booking('u1', undefined, 'Amina W.', 'Nyali Center', 'stage', 's-nyali-center', undefined, true, 'inbound', 'pooled', 2, 900, '7-seater'),
  booking('u2', undefined, 'Peter K.', 'Bamburi Mwisho', 'stage', 's-bamburi-mwisho', undefined, false, 'inbound', 'pooled', 1, 450, '4-seater'),
  booking('u3', undefined, 'Susan M.', 'Likoni Ferry Container', 'stage', 's-likoni-ferry', undefined, true, 'inbound', 'pooled', 3, 1350, '7-seater'),
  booking('u4', undefined, 'Grace A.', 'Kiembeni Mwisho', 'stage', 's-kiembeni-mwisho', undefined, true, 'inbound', 'pooled', 1, 450, '4-seater'),
  booking('u5', undefined, 'John O.', 'Naivas Diani', 'stage', 's-naivas-diani', undefined, false, 'inbound', 'pooled', 2, 900, '11-seater'),
  booking('u6', undefined, 'Mary N.', 'JCC Junction', 'stage', 's-jcc-junction', undefined, true, 'inbound', 'pooled', 1, 450, '4-seater'),
];

export const DRIVER_STATS: DriverStats = {
  todayEarningsKSh: 2450,
  tripsCompleted: 2,
  seatsFilled: 9,
  seatsOffered: 11,
  chartersCompleted: 0,
  rating: 4.8,
};

// Logged-in driver perspective — Patrick (drives c9 inbound — empty 4-seater available for charter demo)
export const ACTIVE_DRIVER_ID = 'c9';
