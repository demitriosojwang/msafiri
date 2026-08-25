'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { STAGES, TRAINS, fmtDateShort } from '@/lib/feeder/seed';
import { computeTripTiming, computeFare } from '@/lib/feeder/calc';
import type { Cab } from '@/lib/feeder/types';
import { useFeederStore } from '@/store/feeder-store';
import { TripTimingTimeline } from './TripTiming';
import { SeatMeter, Stars, StatusBadge, CharterBadge } from './Shared';
import { MapPin, User, Ticket as TicketIcon, CheckCircle2, Crown, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function BookingSheet({ cab, open, onOpenChange }: {
  cab: Cab | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [pickup, setPickup] = useState('');
  const [hasTicket, setHasTicket] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const settings = useFeederStore(s => s.settings);
  const pickupKind = useFeederStore(s => s.pickupKind);
  const offStageDistanceKm = useFeederStore(s => s.offStageDistanceKm);
  const bookingKind = useFeederStore(s => s.bookingKind);
  const seatsRequested = useFeederStore(s => s.seatsRequested);
  const selectedDate = useFeederStore(s => s.selectedDate);
  const bookSeat = useFeederStore(s => s.bookSeat);
  const bookCharter = useFeederStore(s => s.bookCharter);
  const { toast } = useToast();

  if (!cab) return null;

  const stage = STAGES.find(s => s.id === cab.stageId);
  const train = TRAINS.find(t => t.id === cab.trainId);
  if (!stage || !train) return null;

  const timing = computeTripTiming(cab, stage, train, settings, hasTicket, undefined, selectedDate);
  const isCharter = bookingKind === 'charter';

  const fare = computeFare({
    settings,
    pickupKind,
    offStageDistanceKm: pickupKind === 'off-stage' ? offStageDistanceKm : undefined,
    kind: bookingKind,
    capacity: cab.capacity,
  });
  // For pooled with multiple seats, total = perSeat × seatsRequested
  const totalFare = isCharter ? fare.total : fare.perSeat * seatsRequested;

  const full = !isCharter && (cab.bookedSeats + seatsRequested > cab.capacity);
  const charterBlocked = isCharter && cab.bookedSeats > 0;
  const canBook = name.trim().length > 1 && pickup.trim().length > 1 && !full && !charterBlocked;

  function handleBook() {
    if (!cab) return;
    const id = isCharter
      ? bookCharter(cab.id, name.trim(), pickup.trim(), hasTicket)
      : bookSeat(cab.id, name.trim(), pickup.trim(), hasTicket);
    if (id) {
      setConfirmed(true);
      toast({
        title: isCharter ? 'Charter reserved' : 'Seat reserved',
        description: isCharter
          ? `Whole ${cab.cabType} reserved for ${cab.driverName} on ${fmtDateShort(selectedDate)}. Leave by ${timing.latestLeaveTime}.`
          : seatsRequested > 1
            ? `${seatsRequested} seats reserved on ${cab.driverName}'s ${cab.cabType} for ${fmtDateShort(selectedDate)}. Leave by ${timing.latestLeaveTime}.`
            : `You're on ${cab.driverName}'s ${cab.cabType} on ${fmtDateShort(selectedDate)}. Leave by ${timing.latestLeaveTime}.`,
      });
    }
  }

  function handleClose(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setName(''); setPickup(''); setHasTicket(false); setConfirmed(false);
      }, 200);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-xl flex items-center gap-2">
                {cab.driverName}'s {cab.cabType}
                {isCharter && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-900">
                    <Crown className="w-3 h-3" /> Private charter
                  </span>
                )}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Stars rating={cab.driverRating} />
                <span className="text-muted-foreground/50">•</span>
                <span className="font-mono text-xs">{cab.plateNumber}</span>
                <span className="text-muted-foreground/50">•</span>
                <StatusBadge status={cab.status} />
                {cab.charterLocked && <CharterBadge locked />}
              </SheetDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {isCharter ? 'Total fare' : seatsRequested > 1 ? `${seatsRequested} seats` : 'Fare'}
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                KSh {totalFare.toLocaleString()}
              </div>
              {isCharter && (
                <div className="text-[10px] text-muted-foreground">
                  {fare.seats} seats × KSh {fare.perSeat} + KSh {fare.charterPremium}
                </div>
              )}
              {!isCharter && seatsRequested > 1 && (
                <div className="text-[10px] text-muted-foreground">
                  {seatsRequested} × KSh {fare.perSeat}
                </div>
              )}
              {!isCharter && seatsRequested === 1 && cab.currentFare < cab.baseFare && (
                <div className="text-[10px] line-through text-muted-foreground">KSh {cab.baseFare}</div>
              )}
            </div>
          </div>
        </SheetHeader>

        {confirmed ? (
          <div className="px-4 py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                isCharter ? 'bg-violet-100' : 'bg-emerald-100',
              )}>
                <CheckCircle2 className={cn('w-7 h-7', isCharter ? 'text-violet-600' : 'text-emerald-600')} />
              </div>
              <h3 className="text-lg font-semibold">
                {isCharter ? 'Charter reserved!' : 'Seat reserved!'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Be at <span className="font-medium text-foreground">{pickup || stage.name}</span> by{' '}
                <span className="font-medium text-foreground">{timing.latestLeaveTime}</span>.
                {isCharter && ' Driver has been notified and will skip other pooling.'}
              </p>
            </div>
            <TripTimingTimeline timing={timing} hasTicket={hasTicket} />
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="px-4 pb-2 space-y-4">
            {/* Route info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-secondary/60 p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                  <MapPin className="w-3 h-3" /> {pickupKind === 'stage'
                    ? (cab.direction === 'inbound' ? 'Pickup stage' : 'Drop-off stage')
                    : (cab.direction === 'inbound' ? 'Pickup near' : 'Drop-off near')}
                </div>
                <div className="font-medium">{stage.name}</div>
                <div className="text-xs text-muted-foreground">{stage.area} · {stage.coast === 'south' ? 'South' : 'North'} Coast</div>
              </div>
              <div className="rounded-lg bg-secondary/60 p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                  <TicketIcon className="w-3 h-3" /> Train
                </div>
                <div className="font-medium">{train.code}</div>
                <div className="text-xs text-muted-foreground">
                  {cab.direction === 'inbound' ? 'Departs' : 'Arrives'} {train.time}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateShort(selectedDate)}
                </div>
              </div>
            </div>

            {/* The core mechanic — reverse-engineered leave time (inbound only) */}
            {cab.direction === 'inbound' && (
              <div className="rounded-xl border bg-card p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  How this cab's leave time is computed
                </div>
                <TripTimingTimeline timing={timing} hasTicket={hasTicket} />
              </div>
            )}

            {cab.direction === 'outbound' && (
              <div className="rounded-lg bg-secondary/60 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Train arrives</span>
                  <span className="font-medium">{train.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Travel time to {stage.name}</span>
                  <span className="font-medium">~{stage.travelMin} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Drop-off</span>
                  <span className="font-medium">{stage.name}</span>
                </div>
              </div>
            )}

            {/* Fare breakdown for charter */}
            {isCharter && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-violet-700 mb-1">Charter breakdown</div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Base × {cab.capacity} seats</span>
                  <span className="font-medium">KSh {fare.subtotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Charter premium (30%)</span>
                  <span className="font-medium">+KSh {fare.charterPremium}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="font-medium">Total</span>
                  <span className="font-bold text-primary">KSh {fare.total}</span>
                </div>
              </div>
            )}

            {/* Passenger details */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name" className="text-xs flex items-center gap-1">
                  <User className="w-3 h-3" /> Your name
                </Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isCharter ? 'e.g. The Khan Family' : 'e.g. Aisha M.'}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-pickup" className="text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {pickupKind === 'stage'
                    ? 'Stage landmark (optional)'
                    : (cab.direction === 'inbound' ? 'Specific pickup point' : 'Specific drop-off point')}
                </Label>
                <Input
                  id="p-pickup"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder={pickupKind === 'stage' ? stage.landmark ?? stage.name : 'e.g. Near Tuskys Bamburi'}
                  className="h-9"
                />
              </div>

              {cab.direction === 'inbound' && (
                <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <Label htmlFor="p-ticket" className="text-sm font-medium flex items-center gap-1">
                      <TicketIcon className="w-4 h-4" /> I already have my e-ticket
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Skipping ticket printing shaves 20m off the buffer — leave later and still catch the train.
                    </p>
                  </div>
                  <Switch id="p-ticket" checked={hasTicket} onCheckedChange={setHasTicket} />
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <SeatMeter booked={cab.bookedSeats} capacity={cab.capacity} charterLocked={cab.charterLocked} />
              {cab.direction === 'inbound' && (
                <div className="text-right text-xs text-muted-foreground">
                  Auto-locks at <span className="font-medium text-foreground">{timing.cutoffTime}</span>
                </div>
              )}
            </div>

            {charterBlocked && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                This cab already has pooled passengers booked — charter is not available for it. Pick another cab.
              </div>
            )}
          </div>
        )}

        {!confirmed && (
          <SheetFooter className="px-4 pb-4">
            <Button
              className="w-full h-11"
              disabled={!canBook}
              onClick={handleBook}
            >
              <Car className="w-4 h-4 mr-1" />
              {full
                ? 'Not enough seats'
                : charterBlocked
                  ? 'Charter unavailable'
                  : isCharter
                    ? `Book charter · KSh ${totalFare.toLocaleString()}`
                    : seatsRequested > 1
                      ? `Reserve ${seatsRequested} seats · KSh ${totalFare.toLocaleString()}`
                      : `Reserve seat · KSh ${totalFare}`}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
