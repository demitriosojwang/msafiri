// Core timing logic — reverse-engineered "latest leave time" from train departure.
//
// The fundamental insight (from the source conversation):
//   A cab cannot leave until it's full, but "full" depends on strangers showing up
//   at a stage in real time. That unpredictability eats into the buffer passengers
//   need for check-in / ticketing / security. The app converts physical waiting into
//   digital fill-up done ahead of time, with the latest-leave-time reverse-engineered
//   from the train's departure.

import type { Cab, Route, Settings, Train, TripTiming, Booking } from './types';
import { atTime, SIM_NOW } from './seed';

const PEAK_HOURS = [
  { start: 6, end: 9 },     // morning rush
  { start: 12, end: 14 },   // lunch
  { start: 16, end: 19 },   // evening rush
];

function isPeakHour(epochMs: number): boolean {
  const h = new Date(epochMs).getHours();
  return PEAK_HOURS.some(p => h >= p.start && h < p.end);
}

// Travel time from pickup route to terminus, adjusted for time-of-day.
export function travelTimeFor(route: Route, leaveAtMs: number): number {
  return route.travelMin + (isPeakHour(leaveAtMs) ? route.peakAdjustMin : 0);
}

// Per-passenger total buffer (security + check-in + optional ticketing)
// If the passenger already has an e-ticket, the ticketing buffer is skipped —
// they can leave later and still catch the same train.
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

// THE CORE FUNCTION — given a train + route + passenger ticket status, compute
// the latest time the cab can leave the pickup point and still get the passenger
// to the train on time.
//
//   latestLeave = trainDeparture
//                   - securityBuffer
//                   - (hasTicket ? 0 : ticketingBuffer)
//                   - checkInBuffer
//                   - travelTime(route, latestLeave)  ← feedback loop, peak-adjusted
//
// We approximate the feedback loop by computing travel time at the candidate leave time.
export function computeTripTiming(
  cab: Cab,
  route: Route,
  train: Train,
  settings: Settings,
  hasTicket = false,
  now = SIM_NOW,
): TripTiming {
  const departureMs = atTime(train.departureTime);
  const buffer = bufferFor(settings, hasTicket);

  // First pass: assume off-peak to get a candidate leave time
  let candidateLeave = departureMs - (buffer.total + route.travelMin) * 60 * 1000;
  // Refine: recompute travel time at the candidate leave time (peak-adjusted)
  const travelMin = travelTimeFor(route, candidateLeave);
  candidateLeave = departureMs - (buffer.total + travelMin) * 60 * 1000;

  const cutoffMs = candidateLeave - settings.lockCutoffMin * 60 * 1000;
  const nudgeStartMs = cutoffMs - settings.nudgeWindowMin * 60 * 1000;

  const fillPct = cab.capacity > 0 ? cab.bookedSeats / cab.capacity : 0;
  const shouldNudge =
    now >= nudgeStartMs &&
    now < cutoffMs &&
    fillPct < settings.minFillThreshold;

  const minutesUntilCutoff = Math.round((cutoffMs - now) / 60 / 1000);
  const minutesUntilLeave = Math.round((candidateLeave - now) / 60 / 1000);

  return {
    trainDeparture: train.departureTime,
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

// Decide if a cab should auto-lock based on threshold + cutoff proximity
export function shouldAutoLock(cab: Cab, timing: TripTiming, settings: Settings): {
  locked: boolean; reason: string;
} {
  if (cab.status === 'locked' || cab.status === 'departed' || cab.status === 'arrived') {
    return { locked: false, reason: 'already past this stage' };
  }
  if (timing.fillPct >= settings.minFillThreshold && timing.minutesUntilCutoff <= 0) {
    return { locked: true, reason: `Threshold met (${Math.round(timing.fillPct * 100)}%) and cutoff reached` };
  }
  if (timing.minutesUntilLeave <= 0 && timing.fillPct >= settings.minFillThreshold * 0.5) {
    return { locked: true, reason: 'Last-call: leave time reached, half-full or more' };
  }
  return { locked: false, reason: '' };
}

// Apply fare nudge if in nudge window
export function nudgeFare(cab: Cab, timing: TripTiming, settings: Settings): number {
  if (timing.shouldNudge) {
    return Math.round(cab.baseFare * (1 - settings.nudgeDiscountPct / 100));
  }
  return cab.baseFare;
}

// Compute outbound pooling — group arriving passengers by destination zone
export function poolOutboundPassengers(bookings: Booking[]): Map<string, Booking[]> {
  const pools = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.direction !== 'outbound' || b.status === 'cancelled') continue;
    const zone = b.destinationZoneId || 'unknown';
    if (!pools.has(zone)) pools.set(zone, []);
    pools.get(zone)!.push(b);
  }
  return pools;
}
