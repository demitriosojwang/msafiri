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
import { ROUTES, TRAINS } from '@/lib/feeder/seed';
import { computeTripTiming, fmtDuration, fmtCountdown } from '@/lib/feeder/calc';
import type { Cab } from '@/lib/feeder/types';
import { useFeederStore } from '@/store/feeder-store';
import { TripTimingTimeline } from './TripTiming';
import { SeatMeter, Stars, StatusBadge } from './Shared';
import { MapPin, User, Ticket as TicketIcon, CheckCircle2 } from 'lucide-react';
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
  const bookSeat = useFeederStore(s => s.bookSeat);
  const { toast } = useToast();

  if (!cab) return null;

  const route = ROUTES.find(r => r.id === cab.routeId);
  const train = TRAINS.find(t => t.id === cab.trainId);
  if (!route || !train) return null;

  const timing = computeTripTiming(cab, route, train, settings, hasTicket);
  const fare = cab.currentFare;
  const full = cab.bookedSeats >= cab.capacity;
  const canBook = name.trim().length > 1 && pickup.trim().length > 1 && !full;

  function handleBook() {
    if (!cab) return;
    const id = bookSeat(cab.id, name.trim(), pickup.trim(), hasTicket);
    if (id) {
      setConfirmed(true);
      toast({
        title: 'Seat reserved',
        description: `You're on ${cab.driverName}'s ${cab.cabType}. Leave by ${timing.latestLeaveTime}.`,
      });
    }
  }

  function handleClose(v: boolean) {
    onOpenChange(v);
    if (!v) {
      // Reset after sheet closes
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
              <SheetTitle className="text-xl">
                {cab.driverName}'s {cab.cabType}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Stars rating={cab.driverRating} />
                <span className="text-muted-foreground/50">•</span>
                <span className="font-mono text-xs">{cab.plateNumber}</span>
                <span className="text-muted-foreground/50">•</span>
                <StatusBadge status={cab.status} />
              </SheetDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fare</div>
              <div className="text-2xl font-bold tabular-nums text-primary">KSh {fare}</div>
              {cab.currentFare < cab.baseFare && (
                <div className="text-[10px] line-through text-muted-foreground">KSh {cab.baseFare}</div>
              )}
            </div>
          </div>
        </SheetHeader>

        {confirmed ? (
          <div className="px-4 py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">Seat reserved!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Be at <span className="font-medium text-foreground">{pickup || route.landmark}</span> by{' '}
                <span className="font-medium text-foreground">{timing.latestLeaveTime}</span>.
                Driver will be notified.
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
                  <MapPin className="w-3 h-3" /> Pickup
                </div>
                <div className="font-medium">{route.name}</div>
                <div className="text-xs text-muted-foreground">{route.landmark}</div>
              </div>
              <div className="rounded-lg bg-secondary/60 p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                  <TicketIcon className="w-3 h-3" /> Train
                </div>
                <div className="font-medium">{train.code}</div>
                <div className="text-xs text-muted-foreground">Departs {train.departureTime}</div>
              </div>
            </div>

            {/* The core mechanic — reverse-engineered leave time */}
            <div className="rounded-xl border bg-card p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                How this cab's leave time is computed
              </div>
              <TripTimingTimeline timing={timing} hasTicket={hasTicket} />
            </div>

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
                  placeholder="e.g. Aisha M."
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-pickup" className="text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Pickup point (specific landmark)
                </Label>
                <Input
                  id="p-pickup"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder={route.landmark}
                  className="h-9"
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <Label htmlFor="p-ticket" className="text-sm font-medium flex items-center gap-1">
                    <TicketIcon className="w-4 h-4" /> I already have my e-ticket
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Skipping ticket printing shaves <span className="font-semibold">{fmtDuration(settings.ticketingBufferMin)}</span> off the buffer —
                    so you can leave {fmtDuration(settings.ticketingBufferMin)} later and still catch the same train.
                  </p>
                </div>
                <Switch
                  id="p-ticket"
                  checked={hasTicket}
                  onCheckedChange={setHasTicket}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <SeatMeter booked={cab.bookedSeats} capacity={cab.capacity} />
              <div className="text-right text-xs text-muted-foreground">
                Auto-locks at <span className="font-medium text-foreground">{timing.cutoffTime}</span>
                <br />
                <span className={cn(timing.minutesUntilCutoff < 30 ? 'text-amber-700' : '')}>
                  {fmtCountdown(timing.minutesUntilCutoff)}
                </span>
              </div>
            </div>
          </div>
        )}

        {!confirmed && (
          <SheetFooter className="px-4 pb-4">
            <Button
              className="w-full h-11"
              disabled={!canBook}
              onClick={handleBook}
            >
              {full ? 'Sold out' : `Reserve seat • KSh ${fare}`}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
