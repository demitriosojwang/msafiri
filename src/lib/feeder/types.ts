// SGR Feeder — domain types (v2)
//
// The app now covers both legs:
//   1. INBOUND  — passengers heading TO the terminus to catch a departing train
//      (cabs fill up digitally ahead of time; reverse-engineered leave time)
//   2. OUTBOUND — passengers OFFBOARDING an arriving train and connecting with cabs
//      at the SGR waiting/collection points (stages) for drop-off home
//
// Stages are the agreed pickup/drop-off points (existing SGR waiting/collection points).
// Both legs use the same stages.
//
// Booking kinds:
//   - pooled: share a cab with other passengers (default)
//   - charter: book the whole vehicle privately (driver commits, pooled lockout kicks in)

export type CabType = '4-seater' | '7-seater' | '11-seater' | '14-seater';

export type Direction = 'inbound' | 'outbound';

export type Coast = 'south' | 'north';

export type CabStatus = 'filling' | 'locked' | 'departed' | 'arrived';

export type BookingStatus = 'reserved' | 'confirmed' | 'cancelled';

export type BookingKind = 'pooled' | 'charter';

export type PickupKind = 'stage' | 'off-stage';

// A stage = an agreed SGR waiting/collection point used as pickup/drop-off.
// Grouped by area (Likoni, Ukunda, Bamburi, Mtwapa, Malindi, Kombani).
export type Stage = {
  id: string;
  name: string;            // 'Likoni Ferry Container'
  area: string;            // 'Likoni' / 'Ukunda' / 'Bamburi' / 'Mtwapa' / 'Malindi' / 'Kombani'
  coast: Coast;            // South Coast / North Coast
  travelMin: number;       // typical travel time from Mombasa Terminus
  peakAdjustMin: number;   // extra minutes during peak hours
  landmark?: string;       // helper description
};

// A train — either departing Mombasa or arriving at Mombasa
export type Train = {
  id: string;
  code: string;            // 'Madaraka Express'
  time: string;            // 'HH:MM' (24h)
  direction: Direction;    // inbound = depart Mombasa, outbound = arrive at Mombasa
  origin: string;
  destination: string;
};

export type Cab = {
  id: string;
  driverName: string;
  driverRating: number;        // 0..5
  plateNumber: string;
  cabType: CabType;
  capacity: number;
  stageId: string;             // which stage this cab is positioned at / assigned to
  trainId: string;             // which train this cab is tied to
  direction: Direction;        // inbound = filling to go to terminus, outbound = positioned for arrivals
  bookedSeats: number;
  status: CabStatus;
  baseFare: number;            // KSh 450 stage base (per seat, pooled)
  currentFare: number;         // may drop near cutoff to nudge last seats
  // Charter state — if true, driver has committed to a charter booking and pooled
  // requests are locked out for this cab
  charterLocked: boolean;
  departedAt?: number;         // epoch ms
};

export type Booking = {
  id: string;
  cabId?: string;                 // optional — null means "pending auto-assignment"
  passengerName: string;
  pickupPoint: string;
  pickupKind: PickupKind;
  stageId?: string;
  offStageDistanceKm?: number;
  hasTicket: boolean;
  direction: Direction;
  status: BookingStatus;
  kind: BookingKind;
  seatsReserved: number;
  farePaid: number;
  createdAt: number;
  isMine?: boolean;
  vehicleTypePreference?: CabType;  // what vehicle type the passenger requested
  assignedAt?: number;              // when auto-assignment ran
};

export type PickupRequest = {
  id: string;
  passengerName: string;
  pickupPoint: string;
  pickupKind: PickupKind;
  stageId?: string;
  offStageDistanceKm?: number;
  seatsRequested: number;
  trainId?: string;             // which train they're catching / arrived on
  hasTicket: boolean;
  direction: Direction;
  kind: BookingKind;            // pooled vs charter request
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
};

export type Settings = {
  securityBufferMin: number;
  ticketingBufferMin: number;
  checkInBufferMin: number;
  minFillThreshold: number;
  lockCutoffMin: number;
  nudgeDiscountPct: number;
  nudgeWindowMin: number;
  // Fare model
  baseFareStage: number;        // KSh 450 — base fare for stage pickup (per seat, pooled)
  offStageSurchargePerKm: number;  // KSh per km beyond the stage
  offStageMaxRadiusKm: number;     // cap — beyond this, "meet at nearest stage"
  charterMultiplier: number;       // charter = base × capacity × multiplier
};

export type DriverStats = {
  todayEarningsKSh: number;
  tripsCompleted: number;
  seatsFilled: number;
  seatsOffered: number;
  chartersCompleted: number;
  rating: number;
};

// Computed timing for an inbound cab (going to catch a departing train)
export type TripTiming = {
  trainDeparture: string;
  latestLeaveTime: string;
  travelMin: number;
  securityMin: number;
  ticketingMin: number;
  checkInMin: number;
  totalBufferMin: number;
  cutoffTime: string;
  minutesUntilCutoff: number;
  minutesUntilLeave: number;
  fillPct: number;
  shouldNudge: boolean;
};

// Computed fare breakdown for a booking
export type FareBreakdown = {
  base: number;             // stage base (per seat)
  surcharge: number;        // distance-based (0 for stage pickup)
  perSeat: number;          // base + surcharge
  seats: number;            // 1 for pooled, capacity for charter
  subtotal: number;         // perSeat × seats
  charterPremium: number;   // extra for charter privacy
  total: number;            // final fare
  capped: boolean;          // true if distance exceeded radius
};
