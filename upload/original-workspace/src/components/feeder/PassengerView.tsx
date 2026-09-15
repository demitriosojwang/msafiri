'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { STAGES, TRAINS, TRAINS_BY_DIR, fmtDateShort } from '@/lib/feeder/seed';
import { computeTripTiming, nudgeFare, computeFare } from '@/lib/feeder/calc';
import type { Cab, Stage, Train } from '@/lib/feeder/types';
import { useFeederStore } from '@/store/feeder-store';
import { SeatMeter, Stars, StatusBadge, TrainPill, CharterBadge } from './Shared';
import { LeaveCountdownBadge } from './TripTiming';
import { BookingSheet } from './BookingSheet';
import { PaymentSheet } from './PaymentSheet';
import { PassengerLiveTracking } from './PassengerLiveTracking';
import { DatePicker } from './DatePicker';
import { SeatStepper } from './SeatStepper';
import {
  Train as TrainIcon,
  MapPin,
  ArrowRight,
  Users,
  Sparkles,
  Info,
  Navigation,
  Car,
  Crown,
  Ruler,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Anchor,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function PassengerView() {
  const direction = useFeederStore(s => s.passengerDirection);
  const setDirection = useFeederStore(s => s.setPassengerDirection);
  const selectedDate = useFeederStore(s => s.selectedDate);
  const setSelectedDate = useFeederStore(s => s.setSelectedDate);
  const selectedTrainId = useFeederStore(s => s.selectedTrainId);
  const setSelectedTrainId = useFeederStore(s => s.setSelectedTrainId);
  const selectedStageId = useFeederStore(s => s.selectedStageId);
  const setSelectedStageId = useFeederStore(s => s.setSelectedStageId);
  const pickupKind = useFeederStore(s => s.pickupKind);
  const setPickupKind = useFeederStore(s => s.setPickupKind);
  const offStageDistanceKm = useFeederStore(s => s.offStageDistanceKm);
  const setOffStageDistanceKm = useFeederStore(s => s.setOffStageDistanceKm);
  const bookingKind = useFeederStore(s => s.bookingKind);
  const setBookingKind = useFeederStore(s => s.setBookingKind);
  const seatsRequested = useFeederStore(s => s.seatsRequested);
  const setSeatsRequested = useFeederStore(s => s.setSeatsRequested);
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const settings = useFeederStore(s => s.settings);

  const [selectedCab, setSelectedCab] = useState<Cab | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);

  const myBookings = bookings.filter(b => b.status !== 'cancelled' && b.isMine);

  const trains = direction === 'inbound' ? TRAINS_BY_DIR.inbound : TRAINS_BY_DIR.outbound;
  const selectedTrain = trains.find(t => t.id === selectedTrainId) ?? trains[0];

  // For outbound (from terminus), stages are drop-off points, not pickup points
  const pointLabel = direction === 'inbound' ? 'pickup' : 'drop-off';
  const pointLabelCap = direction === 'inbound' ? 'Pickup' : 'Drop-off';

  // Group stages by area for the picker
  const stagesByArea = useMemo(() => {
    const map = new Map<string, Stage[]>();
    for (const s of STAGES) {
      if (!map.has(s.area)) map.set(s.area, []);
      map.get(s.area)!.push(s);
    }
    return Array.from(map.entries());
  }, []);

  // Available cabs for the selected train + stage + seats
  const availableCabs = useMemo(() => {
    let list = cabs.filter(c =>
      c.trainId === selectedTrainId &&
      c.direction === direction &&
      c.status === 'filling' &&
      !c.charterLocked &&
      (c.capacity - c.bookedSeats >= (bookingKind === 'pooled' ? seatsRequested : 1)),
    );
    if (selectedStageId) {
      list = list.filter(c => c.stageId === selectedStageId);
    }
    return list;
  }, [cabs, selectedTrainId, selectedStageId, direction, seatsRequested, bookingKind]);

  function openBooking(cab: Cab) {
    setSelectedCab(cab);
    setSheetOpen(true);
  }

  // Live fare preview for the current pickupKind + distance + bookingKind + seats
  const previewCapacity = selectedCab?.capacity ?? 4;
  const farePreview = computeFare({
    settings,
    pickupKind,
    offStageDistanceKm: pickupKind === 'off-stage' ? offStageDistanceKm : undefined,
    kind: bookingKind,
    capacity: previewCapacity,
  });
  // For pooled with multiple seats, total = perSeat × seatsRequested
  const pooledTotal = bookingKind === 'pooled'
    ? farePreview.perSeat * seatsRequested
    : farePreview.total;

  return (
    <div className="space-y-4 pb-4">
      {/* Direction toggle */}
      <Tabs value={direction} onValueChange={(v) => setDirection(v as 'inbound' | 'outbound')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="inbound" className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> To Terminus
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5" /> From Terminus
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait">
        <motion.div
          key={direction}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          {/* Date picker */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarIcon className="w-3.5 h-3.5" />
              {direction === 'inbound' ? 'Travelling on which date?' : 'Arriving on which date?'}
            </div>
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
            <div className="mt-1.5 text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{fmtDateShort(selectedDate)}</span>
            </div>
          </div>

          {/* Train selector */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrainIcon className="w-3.5 h-3.5" />
              {direction === 'inbound' ? 'Catching which train?' : 'Arriving on which train?'}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {trains.map(t => (
                <TrainPill
                  key={t.id}
                  code={t.code}
                  time={t.time}
                  direction={direction}
                  active={selectedTrainId === t.id}
                  onClick={() => setSelectedTrainId(t.id)}
                />
              ))}
            </div>
          </div>

          {/* Stage picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {pointLabelCap} stage
              </div>
              {selectedStageId && (
                <button
                  onClick={() => setSelectedStageId(null)}
                  className="text-[11px] text-primary hover:underline"
                >
                  Show all stages
                </button>
              )}
            </div>
            <div className="space-y-2">
              {stagesByArea.map(([area, stages]) => (
                <div key={area}>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
                    {stages[0].coast === 'south' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[9px] uppercase">South Coast</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] uppercase">North Coast</span>
                    )}
                    <span>{area}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {stages.map(stage => {
                      const active = selectedStageId === stage.id;
                      const waitingPassengers = useFeederStore.getState().getPassengersWaitingAtStage(stage.id);
                      return (
                        <button
                          key={stage.id}
                          onClick={() => setSelectedStageId(active ? null : stage.id)}
                          className={cn(
                            'text-left p-2 rounded-lg border text-xs transition-all',
                            active
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card hover:bg-accent border-border',
                          )}
                        >
                          <div className="font-medium truncate">{stage.name}</div>
                          <div className={cn('text-[10px] mt-0.5', active ? 'opacity-80' : 'text-muted-foreground')}>
                            ~{stage.travelMin}m · KSh {settings.baseFareStage}
                          </div>
                          {waitingPassengers > 0 && (
                            <div className={cn(
                              'text-[10px] mt-0.5 inline-flex items-center gap-0.5',
                              active ? 'opacity-80' : 'text-amber-700',
                            )}>
                              <Users className="w-2.5 h-2.5" /> {waitingPassengers} waiting
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pickup options: stage vs off-stage + charter toggle */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Car className="w-4 h-4" /> {pointLabelCap} options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Pickup kind toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary/60">
                <button
                  onClick={() => setPickupKind('stage')}
                  disabled={bookingKind === 'charter'}
                  className={cn(
                    'flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all',
                    pickupKind === 'stage'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground',
                    bookingKind === 'charter' && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <MapPin className="w-3 h-3" /> At stage
                </button>
                <button
                  onClick={() => setPickupKind('off-stage')}
                  disabled={bookingKind === 'charter'}
                  className={cn(
                    'flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all',
                    pickupKind === 'off-stage'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground',
                    bookingKind === 'charter' && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <Ruler className="w-3 h-3" /> Off-stage
                </button>
              </div>

              {/* Off-stage distance slider */}
              <AnimatePresence>
                {pickupKind === 'off-stage' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-muted-foreground">Distance from nearest stage</Label>
                      <span className="font-semibold tabular-nums">{offStageDistanceKm.toFixed(1)} km</span>
                    </div>
                    <Slider
                      value={[offStageDistanceKm]}
                      onValueChange={(v) => setOffStageDistanceKm(v[0])}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>0 km</span>
                      <span className={cn(offStageDistanceKm > settings.offStageMaxRadiusKm && 'text-destructive font-medium')}>
                        Cap: {settings.offStageMaxRadiusKm} km
                      </span>
                      <span>5 km</span>
                    </div>
                    {offStageDistanceKm > settings.offStageMaxRadiusKm && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Beyond {settings.offStageMaxRadiusKm} km, the app says "please meet at the nearest stage."
                          Fare is capped at the maximum-radius surcharge.
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Charter toggle */}
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="flex-1">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Crown className="w-4 h-4 text-violet-600" /> Book the whole vehicle (private)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Reserve the entire cab for your family/group. Driver commits to skipping pooling for this run.
                    Pricing: base × capacity × {settings.charterMultiplier}x charter multiplier.
                  </p>
                </div>
                <Switch
                  checked={bookingKind === 'charter'}
                  onCheckedChange={(c) => {
                    setBookingKind(c ? 'charter' : 'pooled');
                    if (c) setPickupKind('stage');
                  }}
                />
              </div>

              {/* Live fare preview */}
              <div className="rounded-lg bg-card border p-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Live fare preview</div>
                <div className="space-y-1 text-xs">
                  <Row label="Base (per seat)" value={`KSh ${farePreview.base}`} />
                  {farePreview.surcharge > 0 && (
                    <Row
                      label={`Distance surcharge (${offStageDistanceKm.toFixed(1)} km × KSh ${settings.offStageSurchargePerKm})`}
                      value={`+KSh ${farePreview.surcharge}`}
                    />
                  )}
                  <Row label="Per seat" value={`KSh ${farePreview.perSeat}`} />
                  {bookingKind === 'pooled' && seatsRequested > 1 && (
                    <Row label={`Seats × ${seatsRequested}`} value={`KSh ${farePreview.perSeat} × ${seatsRequested}`} />
                  )}
                  {bookingKind === 'charter' && (
                    <>
                      <Row label={`Seats (whole vehicle)`} value={`${farePreview.seats}`} />
                      <Row label="Subtotal" value={`KSh ${farePreview.subtotal}`} />
                      <Row
                        label={`Charter premium (${((settings.charterMultiplier - 1) * 100).toFixed(0)}%)`}
                        value={`+KSh ${farePreview.charterPremium}`}
                      />
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t">
                  <span className="text-sm font-medium">
                    Total {bookingKind === 'pooled' && seatsRequested > 1 && `(${seatsRequested} seats)`}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-primary">KSh {pooledTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seat count selector (pooled only — charter books whole vehicle) */}
          {bookingKind === 'pooled' && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Users className="w-3.5 h-3.5" /> How many seats?
              </div>
              <SeatStepper
                value={seatsRequested}
                onChange={setSeatsRequested}
                min={1}
                max={14}
              />
              {seatsRequested > 1 && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  Booking for <span className="font-medium text-foreground">{seatsRequested} passengers</span> —
                  total fare: <span className="font-medium text-primary">KSh {(farePreview.perSeat * seatsRequested).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Available cabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {bookingKind === 'charter' ? 'Available for charter' : 'Available pooled cabs'}
              </h3>
              <span className="text-xs text-muted-foreground">{availableCabs.length} cabs</span>
            </div>

            {availableCabs.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {selectedStageId
                    ? 'No cabs at this stage for this train. Try another stage or "Show all stages".'
                    : 'No cabs posted for this train yet.'}
                </CardContent>
              </Card>
            )}

            {availableCabs.map(cab => {
              const stage = STAGES.find(s => s.id === cab.stageId)!;
              const train = TRAINS.find(t => t.id === cab.trainId)!;
              const timing = computeTripTiming(cab, stage, train, settings, false, undefined, selectedDate);
              const fare = nudgeFare(cab, timing, settings);
              const full = cab.bookedSeats >= cab.capacity;
              const charterBlocked = bookingKind === 'charter' && cab.bookedSeats > 0;

              return (
                <motion.div key={cab.id} layout whileTap={{ scale: 0.99 }}>
                  <CabCard
                    cab={cab}
                    stage={stage}
                    train={train}
                    fare={fare}
                    timing={timing}
                    full={full || charterBlocked}
                    bookingKind={bookingKind}
                    seatsRequested={seatsRequested}
                    onBook={() => openBooking(cab)}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* How it works */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> How stages & fares work
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1.5 pt-0">
              <p>Drivers use the existing SGR waiting/collection points as stages. {direction === 'inbound' ? 'Pick one to see cabs positioned there for pickup.' : 'Pick one to see cabs that will drop you off there.'} Each cab is tied to a specific train and fills up digitally ahead of time.</p>
              <p>Base fare is <span className="font-medium text-foreground">KSh {settings.baseFareStage}</span> for stage {pointLabel}. Off-stage {pointLabel} adds <span className="font-medium text-foreground">KSh {settings.offStageSurchargePerKm}/km</span> beyond the stage, capped at {settings.offStageMaxRadiusKm} km — beyond that, please meet at the nearest stage.</p>
              <p>Private charter = book the whole vehicle. Driver commits to skipping pooling for this run, and you pay the full-vehicle fare.</p>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Live tracking — show for the first assigned booking */}
      {myBookings.length > 0 && myBookings[0].cabId && (
        <PassengerLiveTracking cabId={myBookings[0].cabId} />
      )}

      {/* My bookings */}
      {myBookings.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Users className="w-4 h-4" /> My bookings
          </h3>
          {myBookings.map(b => {
            const cab = cabs.find(c => c.id === b.cabId);
            if (!cab) return null;
            const stage = STAGES.find(s => s.id === b.stageId);
            const train = TRAINS.find(t => t.id === cab.trainId);
            const needsPayment = b.status === 'awaiting_payment' || b.status === 'payment_failed';
            const isPaid = b.status === 'payment_confirmed' || b.status === 'confirmed' || b.status === 'completed';
            return (
              <Card key={b.id} className={cn(
                b.kind === 'charter' && 'border-violet-300 bg-violet-50/30',
                needsPayment && 'border-amber-300 bg-amber-50/30',
              )}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{stage?.name ?? b.pickupPoint}</span>
                      {b.kind === 'charter' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-900">
                          <Crown className="w-2.5 h-2.5" /> Charter
                        </span>
                      )}
                      {needsPayment && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          Payment due
                        </span>
                      )}
                      {isPaid && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Paid
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtDateShort(selectedDate)} · {cab.cabType} · {cab.plateNumber} · {train?.code} {train?.time}
                    </div>
                    <div className="text-xs font-medium mt-0.5">
                      KSh {b.farePaid.toLocaleString()}
                      {b.kind === 'pooled' && b.seatsReserved > 1 && (
                        <span className="text-muted-foreground font-normal"> ({b.seatsReserved} seats)</span>
                      )}
                    </div>
                  </div>
                  {needsPayment ? (
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => setPaymentBookingId(b.id)}
                    >
                      Pay now
                    </Button>
                  ) : (
                    <StatusBadge status={cab.status} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BookingSheet cab={selectedCab} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Payment sheet — opens when user clicks "Pay now" */}
      <PaymentSheet
        booking={paymentBookingId ? bookings.find(b => b.id === paymentBookingId) ?? null : null}
        open={!!paymentBookingId}
        onOpenChange={(v) => !v && setPaymentBookingId(null)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function CabCard({ cab, stage, train, fare, timing, full, bookingKind, seatsRequested, onBook }: {
  cab: Cab; stage: Stage; train: Train; fare: number;
  timing: ReturnType<typeof computeTripTiming>;
  full: boolean; bookingKind: 'pooled' | 'charter'; seatsRequested: number; onBook: () => void;
}) {
  const pooledTotal = fare * seatsRequested;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{stage.name}</span>
              <StatusBadge status={cab.status} />
              {timing.shouldNudge && bookingKind === 'pooled' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  <Sparkles className="w-2.5 h-2.5" /> -10% fare
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{cab.driverName}</span>
              <Stars rating={cab.driverRating} />
              <span className="text-muted-foreground/50">•</span>
              <span className="font-mono">{cab.plateNumber}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3" /> {stage.area} · {stage.coast === 'south' ? 'South Coast' : 'North Coast'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {bookingKind === 'charter'
                ? 'Charter'
                : seatsRequested > 1
                  ? `${seatsRequested} seats`
                  : 'Fare'}
            </div>
            <div className="font-bold text-primary tabular-nums">
              KSh {bookingKind === 'charter'
                ? Math.round(cab.baseFare * cab.capacity * 1.3).toLocaleString()
                : pooledTotal.toLocaleString()}
            </div>
            {bookingKind === 'pooled' && seatsRequested === 1 && fare < cab.baseFare && (
              <div className="text-[10px] line-through text-muted-foreground">KSh {cab.baseFare}</div>
            )}
            {bookingKind === 'pooled' && seatsRequested > 1 && (
              <div className="text-[10px] text-muted-foreground">KSh {fare}/seat</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Car className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{cab.cabType}</span>
            </div>
            {cab.direction === 'inbound' && <LeaveCountdownBadge timing={timing} />}
            {cab.direction === 'outbound' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" /> Arrives {train.time}
              </span>
            )}
          </div>
          <SeatMeter booked={cab.bookedSeats} capacity={cab.capacity} charterLocked={cab.charterLocked} />
        </div>

        <Button
          className="w-full h-9"
          size="sm"
          disabled={full || cab.status !== 'filling'}
          onClick={onBook}
        >
          {full
            ? cab.bookedSeats > 0 && bookingKind === 'charter'
              ? 'Has pooled passengers'
              : 'Not enough seats'
            : bookingKind === 'charter'
              ? `Book charter · KSh ${Math.round(cab.baseFare * cab.capacity * 1.3).toLocaleString()}`
              : seatsRequested > 1
                ? `Reserve ${seatsRequested} seats · KSh ${pooledTotal.toLocaleString()}`
                : 'Reserve seat'}
        </Button>
      </CardContent>
    </Card>
  );
}
