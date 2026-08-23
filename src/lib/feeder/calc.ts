// Core logic — timing + fare calculation.
//
// Two distinct calculations:
//   1. INBOUND trip timing: reverse-engineered "latest leave time" from train departure.
//      (Same as v1 — for passengers heading TO the terminus to catch a departing train.)
//   2. FARE model: base KSh 450 (stage) + distance surcharge (off-stage) + charter premium.

import type { Cab, Settings, Stage, Train, TripTiming, Booking, FareBreakdown, PickupKind, BookingKind } from './types';
import { atTime, atTimeOnDate, SIM_NOW } from './seed';

const PEAK_HOURS = [
  { start: 6, end: 9 },     // morning rush
  { start: 12, end: 14 },   // lunch
  { start: 16, end: 19 },   // evening rush
];

function isPeakHour(epochMs: number): boolean {
  const h = new Date(epochMs).getHours();
  return PEAK_HOURS.some(p => h >= p.start && h < p.end);
}

// Travel time from stage to terminus, peak-adjusted
export function travelTimeFor(stage: Stage, leaveAtMs: number): number {
  return stage.travelMin + (isPeakHour(leaveAtMs) ? stage.peakAdjustMin : 0);
}

// Per-passenger total buffer (security + check-in + optional ticketing)
export function bufferFor(settings: Settings, hasTicket: boolean): {
  security: number; ticketing: number; checkIn: number; total: number;
} {
  return {
    security: settings.securityBufferMin,
    ticketing: hasTicket ? 0 : settings.ticketingBufferMin,
    checkIn: settings.checkInBufferMin,
    total: settings.securityBufferMin + (hasTicket ? 0 : settings.ticketingBufferMin) + settings.checkInBufferMin,
  };
}

// THE CORE INBOUND FUNCTION — given a train + stage + passenger ticket status, compute
// the latest time the cab can leave the stage and still get passengers to the train on time.
// `dateStr` (YYYY-MM-DD) determines which day the train runs on.
export function computeTripTiming(
  cab: Cab,
  stage: Stage,
  train: Train,
  settings: Settings,
  hasTicket = false,
  now = SIM_NOW,
  dateStr?: string,
): TripTiming {
  const departureMs = dateStr ? atTimeOnDate(train.time, dateStr) : atTime(train.time);
  const buffer = bufferFor(settings, hasTicket);

  let candidateLeave = departureMs - (buffer.total + stage.travelMin) * 60 * 1000;
  const travelMin = travelTimeFor(stage, candidateLeave);
  candidateLeave = departureMs - (buffer.total + travelMin) * 60 * 1000;

  const cutoffMs = candidateLeave - settings.lockCutoffMin * 60 * 1000;
  const nudgeStartMs = cutoffMs - settings.nudgeWindowMin * 60 * 1000;

  const fillPct = cab.capacity > 0 ? cab.bookedSeats / cab.capacity : 0;
  const shouldNudge =
    now >= nudgeStartMs &&
    now < cutoffMs &&
    fillPct < settings.minFillThreshold &&
    !cab.charterLocked;

  const minutesUntilCutoff = Math.round((cutoffMs - now) / 60 / 1000);
  const minutesUntilLeave = Math.round((candidateLeave - now) / 60 / 1000);

  return {
    trainDeparture: train.time,
    latestLeaveTime: fmtTime(candidateLeave),
    travelMin,
    securityMin: buffer.security,
    ticketingMin: buffer.ticketing,
    checkInMin: buffer.checkIn,
    totalBufferMin: buffer.total,
    cutoffTime: fmtTime(cutoffMs),
    minutesUntilCutoff,
    minutesUntilLeave,
    fillPct,
    shouldNudge,
  };
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Format minutes as "Xh Ym" or "Ym"
export function fmtDuration(min: number): string {
  if (min < 0) return `-${fmtDuration(-min)}`;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Human countdown
export function fmtCountdown(min: number): string {
  if (min < 0) return `past by ${fmtDuration(-min)}`;
  if (min === 0) return 'now';
  return `in ${fmtDuration(min)}`;
}

// Auto-lock decision based on threshold + cutoff proximity
export function shouldAutoLock(cab: Cab, timing: TripTiming, settings: Settings): {
  locked: boolean; reason: string;
} {
  if (cab.status === 'locked' || cab.status === 'departed' || cab.status === 'arrived') {
    return { locked: false, reason: 'already past this stage' };
  }
  if (cab.charterLocked) {
    return { locked: true, reason: 'Charter locked — driver committed to private booking' };
  }
  if (timing.fillPct >= settings.minFillThreshold && timing.minutesUntilCutoff <= 0) {
    return { locked: true, reason: `Threshold met (${Math.round(timing.fillPct * 100)}%) and cutoff reached` };
  }
  if (timing.minutesUntilLeave <= 0 && timing.fillPct >= settings.minFillThreshold * 0.5) {
    return { locked: true, reason: 'Last-call: leave time reached, half-full or more' };
  }
  return { locked: false, reason: '' };
}

// Apply fare nudge if in nudge window (pooled only — charters don't nudge)
export function nudgeFare(cab: Cab, timing: TripTiming, settings: Settings): number {
  if (timing.shouldNudge && !cab.charterLocked) {
    return Math.round(cab.baseFare * (1 - settings.nudgeDiscountPct / 100));
  }
  return cab.baseFare;
}

// ===================== FARE MODEL =====================
//
// Per the user spec:
//   - Base fare: KSh 450 (stage pickup, per seat, pooled)
//   - Off-stage: +KSh 50/km beyond the stage, capped at 3km
//     (beyond 3km → "please meet at nearest stage")
//   - Charter: book whole vehicle = base × capacity × 1.3 multiplier
//     (charter pays for all seats + small privacy premium)

export function computeFare(params: {
  settings: Settings;
  pickupKind: PickupKind;
  offStageDistanceKm?: number;
  kind: BookingKind;
  capacity: number;
}): FareBreakdown {
  const { settings, pickupKind, offStageDistanceKm, kind, capacity } = params;
  const base = settings.baseFareStage;

  // Distance surcharge (off-stage only)
  let surcharge = 0;
  let capped = false;
  if (pickupKind === 'off-stage') {
    const km = offStageDistanceKm ?? 0;
    if (km > settings.offStageMaxRadiusKm) {
      capped = true;
      surcharge = settings.offStageSurchargePerKm * settings.offStageMaxRadiusKm;
    } else {
      surcharge = Math.round(settings.offStageSurchargePerKm * km);
    }
  }

  const perSeat = base + surcharge;
  const seats = kind === 'charter' ? capacity : 1;
  const subtotal = perSeat * seats;
  const charterPremium = kind === 'charter'
    ? Math.round(subtotal * (settings.charterMultiplier - 1))
    : 0;
  const total = subtotal + charterPremium;

  return {
    base,
    surcharge,
    perSeat,
    seats,
    subtotal,
    charterPremium,
    total,
    capped,
  };
}

// Charter visibility rule — driver should NOT see charter requests
// if they already have active pooled bookings (per user's design decision).
export function canDriverAcceptCharter(cab: Cab, bookings: Booking[]): {
  allowed: boolean; reason: string;
} {
  if (cab.charterLocked) {
    return { allowed: false, reason: 'Already committed to a charter' };
  }
  if (cab.status !== 'filling') {
    return { allowed: false, reason: `Cab is ${cab.status}` };
  }
  const activePooled = bookings.filter(
    b => b.cabId === cab.id && b.status !== 'cancelled' && b.kind === 'pooled',
  );
  if (activePooled.length > 0) {
    return {
      allowed: false,
      reason: `Already has ${activePooled.length} pooled passenger${activePooled.length > 1 ? 's' : ''} — reassigning them would break trust`,
    };
  }
  return { allowed: true, reason: '' };
}

// Compute outbound pooling — group arriving passengers by destination stage
export function poolOutboundPassengers(bookings: Booking[]): Map<string, Booking[]> {
  const pools = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.direction !== 'outbound' || b.status === 'cancelled') continue;
    const zone = b.stageId || 'unknown';
    if (!pools.has(zone)) pools.set(zone, []);
    pools.get(zone)!.push(b);
  }
  return pools;
}
