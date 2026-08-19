// SGR Feeder — domain types
// The app solves two coordination problems:
//   1. Inbound  (many → terminus): convert physical "wait until full" into digital "book until full"
//   2. Outbound (terminus → many): pool arriving passengers by destination zone

export type CabType = '4-seater' | '7-seater' | '11-seater' | '14-seater';

export type Direction = 'inbound' | 'outbound';

export type CabStatus = 'filling' | 'locked' | 'departed' | 'arrived';

export type BookingStatus = 'reserved' | 'confirmed' | 'cancelled';

export type Route = {
  id: string;
  name: string;            // 'Jomvu', 'Miritini', 'Shanzu', 'Bamburi', 'Nyali', 'CBD'
  zone: Direction;         // route serves inbound (to terminus) or outbound (from terminus)
  travelMin: number;       // typical travel time to/from Mombasa Terminus
  peakAdjustMin: number;   // extra minutes during peak hours
  baseFare: number;        // KSh
  landmark: string;        // pickup landmark e.g. 'KPLC offices'
};

export type Train = {
  id: string;
  code: string;            // 'SGR 01'
  departureTime: string;   // 'HH:MM' (24h)
  destination: string;     // 'Nairobi'
  origin: string;          // 'Mombasa Terminus'
};

export type Cab = {
  id: string;
  driverName: string;
  driverRating: number;        // 0..5
  plateNumber: string;
  cabType: CabType;
  capacity: number;
  routeId: string;
  trainId: string;             // inbound cabs are tied to a specific train
  direction: Direction;
  bookedSeats: number;
  status: CabStatus;
  currentFare: number;         // may drop near cutoff to nudge last seats
  baseFare: number;
  departedAt?: number;         // epoch ms
};

export type Booking = {
  id: string;
  cabId: string;
  passengerName: string;
  pickupPoint: string;
  hasTicket: boolean;          // tighter buffer if true (already printed e-ticket)
  direction: Direction;
  status: BookingStatus;
  createdAt: number;
  destinationZoneId?: string;  // outbound only
  isMine?: boolean;            // true if created by the current passenger in this session
};

export type PickupRequest = {
  id: string;
  passengerName: string;
  pickupPoint: string;
  destinationZoneId?: string;
  seatsRequested: number;
  trainId?: string;            // inbound: which train they're catching
  hasTicket: boolean;
  direction: Direction;
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
};

export type Settings = {
  securityBufferMin: number;   // security screening
  ticketingBufferMin: number;  // ticket printing (skip if hasTicket)
  checkInBufferMin: number;    // check-in gate
  minFillThreshold: number;    // 0..1 — fraction of seats that must be booked to lock
  lockCutoffMin: number;       // lock this many minutes before latestLeaveTime
  nudgeDiscountPct: number;    // fare drop near cutoff
  nudgeWindowMin: number;      // apply nudge within this window before cutoff
};

export type DriverStats = {
  todayEarningsKSh: number;
  tripsCompleted: number;
  seatsFilled: number;
  seatsOffered: number;
  rating: number;
};

// Computed timing for an inbound cab
export type TripTiming = {
  trainDeparture: string;       // 'HH:MM'
  latestLeaveTime: string;      // 'HH:MM' — reverse-engineered
  travelMin: number;
  securityMin: number;
  ticketingMin: number;         // 0 if passenger has ticket
  checkInMin: number;
  totalBufferMin: number;
  cutoffTime: string;           // when the cab auto-locks if threshold met
  minutesUntilCutoff: number;   // can be negative if past
  minutesUntilLeave: number;
  fillPct: number;              // 0..1
  shouldNudge: boolean;         // in nudge window AND not at threshold
};
