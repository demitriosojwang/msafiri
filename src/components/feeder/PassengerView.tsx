'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES, TRAINS } from '@/lib/feeder/seed';
import { computeTripTiming, nudgeFare } from '@/lib/feeder/calc';
import type { Cab } from '@/lib/feeder/types';
import { useFeederStore } from '@/store/feeder-store';
import { SeatMeter, Stars, StatusBadge, TrainPill } from './Shared';
import { LeaveCountdownBadge } from './TripTiming';
import { BookingSheet } from './BookingSheet';
import {
  Train as TrainIcon,
  MapPin,
  ArrowRight,
  Users,
  Sparkles,
  Info,
  Navigation,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function PassengerView() {
  const direction = useFeederStore(s => s.passengerDirection);
  const setDirection = useFeederStore(s => s.setPassengerDirection);
  const selectedTrainId = useFeederStore(s => s.selectedTrainId);
  const setSelectedTrainId = useFeederStore(s => s.setSelectedTrainId);
  const selectedOutboundZoneId = useFeederStore(s => s.selectedOutboundZoneId);
  const setSelectedOutboundZoneId = useFeederStore(s => s.setSelectedOutboundZoneId);
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const settings = useFeederStore(s => s.settings);
  const cancelBooking = useFeederStore(s => s.cancelBooking);

  const [selectedCab, setSelectedCab] = useState<Cab | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const myBookings = bookings.filter(b => b.status !== 'cancelled' && b.isMine);

  const inboundCabs = useMemo(
    () => cabs.filter(c => c.direction === 'inbound' && c.trainId === selectedTrainId),
    [cabs, selectedTrainId],
  );

  const outboundCabs = useMemo(
    () => selectedOutboundZoneId
      ? cabs.filter(c => c.direction === 'outbound' && c.routeId === selectedOutboundZoneId)
      : [],
    [cabs, selectedOutboundZoneId],
  );

  const outboundZones = ROUTES.filter(r => r.zone === 'outbound');

  // Count waiting passengers per outbound zone (from bookings on any outbound cab in that zone)
  const outboundZoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of outboundZones) {
      map[r.id] = cabs
        .filter(c => c.direction === 'outbound' && c.routeId === r.id)
        .reduce((sum, c) => sum + c.bookedSeats, 0);
    }
    return map;
  }, [cabs, outboundZones]);

  function openBooking(cab: Cab) {
    setSelectedCab(cab);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Direction toggle */}
      <Tabs value={direction} onValueChange={(v) => setDirection(v as 'inbound' | 'outbound')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="inbound" className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> To Terminus
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> From Terminus
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait">
        {direction === 'inbound' ? (
          <motion.div
            key="inbound"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Train selector */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                <TrainIcon className="w-3.5 h-3.5" /> Catching which train?
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {TRAINS.map(t => (
                  <TrainPill
                    key={t.id}
                    code={t.code}
                    time={t.departureTime}
                    active={selectedTrainId === t.id}
                    onClick={() => setSelectedTrainId(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Available cabs for selected train */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Available cabs</h3>
                <span className="text-xs text-muted-foreground">{inboundCabs.length} cabs filling</span>
              </div>

              {inboundCabs.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No cabs posted for this train yet.
                  </CardContent>
                </Card>
              )}

              {inboundCabs.map(cab => (
                <InboundCabCard
                  key={cab.id}
                  cab={cab}
                  settings={settings}
                  onBook={() => openBooking(cab)}
                />
              ))}
            </div>

            {/* How it works */}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> How fill-up works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5 pt-0">
                <p>Each cab posts a trip tied to a specific train. The app works out the latest time the cab can leave your pickup point and still get you to the train on time — accounting for travel, security, ticketing, and check-in.</p>
                <p>Reserve a seat ahead of time. Once the cab hits 70% booked (or the cutoff arrives), departure locks in and everyone gets notified.</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="outbound"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Where are you heading?
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  You're arriving at Mombasa Terminus. Pick a destination zone and we'll pool you with passengers heading the same way.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {outboundZones.map(zone => {
                    const count = outboundZoneCounts[zone.id] || 0;
                    const active = selectedOutboundZoneId === zone.id;
                    return (
                      <button
                        key={zone.id}
                        onClick={() => setSelectedOutboundZoneId(zone.id)}
                        className={cn(
                          'text-left p-3 rounded-xl border transition-all',
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-card hover:bg-accent border-border',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{zone.name}</span>
                          {count > 0 && (
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full',
                              active ? 'bg-primary-foreground/20' : 'bg-secondary',
                            )}>
                              {count} waiting
                            </span>
                          )}
                        </div>
                        <div className={cn(
                          'text-[11px] mt-0.5',
                          active ? 'opacity-80' : 'text-muted-foreground',
                        )}>
                          ~{zone.travelMin}m · KSh {zone.baseFare}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedOutboundZoneId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Pooled cabs to {outboundZones.find(z => z.id === selectedOutboundZoneId)?.name}</h3>
                  <span className="text-xs text-muted-foreground">{outboundCabs.length} cabs</span>
                </div>
                {outboundCabs.map(cab => (
                  <OutboundCabCard key={cab.id} cab={cab} onJoin={() => openBooking(cab)} />
                ))}
                {outboundCabs.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No cabs positioned for this zone yet. Drivers get a heads-up before your train arrives.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Dispersal matching
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5 pt-0">
                <p>Getting to the terminus is many-to-one. The return leg is the opposite — one terminus, scattered destinations. This side pools arriving passengers by zone so a cab fills up by destination, not by waiting at a stage.</p>
                <p>Drivers are notified ahead of your train's arrival so they're positioned and ready to pool.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My bookings */}
      {myBookings.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Users className="w-4 h-4" /> My bookings
          </h3>
          {myBookings.map(b => {
            const cab = cabs.find(c => c.id === b.cabId);
            if (!cab) return null;
            const route = ROUTES.find(r => r.id === cab.routeId);
            const train = TRAINS.find(t => t.id === cab.trainId);
            return (
              <Card key={b.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{route?.name}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{train?.code} · {train?.departureTime}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {cab.cabType} · {cab.plateNumber} · {b.pickupPoint}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={cab.status} />
                    {cab.status === 'filling' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7 text-xs"
                        onClick={() => cancelBooking(b.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BookingSheet cab={selectedCab} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

function InboundCabCard({ cab, settings, onBook }: {
  cab: Cab; settings: ReturnType<typeof useFeederStore.getState>['settings']; onBook: () => void;
}) {
  const route = ROUTES.find(r => r.id === cab.routeId)!;
  const train = TRAINS.find(t => t.id === cab.trainId)!;
  const timing = computeTripTiming(cab, route, train, settings, false);
  const fare = nudgeFare(cab, timing, settings);
  const full = cab.bookedSeats >= cab.capacity;

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.99 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{route.name}</span>
                <StatusBadge status={cab.status} />
                {timing.shouldNudge && (
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
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fare</div>
              <div className="font-bold text-primary tabular-nums">KSh {fare}</div>
              {fare < cab.baseFare && (
                <div className="text-[10px] line-through text-muted-foreground">KSh {cab.baseFare}</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Car className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">{cab.cabType}</span>
              </div>
              <LeaveCountdownBadge timing={timing} />
            </div>
            <SeatMeter booked={cab.bookedSeats} capacity={cab.capacity} />
          </div>

          <Button
            className="w-full h-9"
            size="sm"
            disabled={full || cab.status !== 'filling'}
            onClick={onBook}
          >
            {full ? 'Sold out' : cab.status === 'filling' ? 'Reserve seat' : 'Already departed'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OutboundCabCard({ cab, onJoin }: { cab: Cab; onJoin: () => void }) {
  const route = ROUTES.find(r => r.id === cab.routeId)!;
  const train = TRAINS.find(t => t.id === cab.trainId)!;
  const full = cab.bookedSeats >= cab.capacity;

  // Outbound: train arrives at terminus, then cab pools passengers
  return (
    <Card>
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{cab.driverName}'s {cab.cabType}</span>
              <StatusBadge status={cab.status} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Stars rating={cab.driverRating} />
              <span className="text-muted-foreground/50">•</span>
              <span className="font-mono">{cab.plateNumber}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fare</div>
            <div className="font-bold text-primary tabular-nums">KSh {cab.currentFare}</div>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/50 p-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Positioned for arriving</span>
            <span className="font-medium">{train.code} · ~{train.departureTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Drop-off zone</span>
            <span className="font-medium">{route.name} ({route.landmark})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Travel time</span>
            <span className="font-medium">~{route.travelMin} min</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <SeatMeter booked={cab.bookedSeats} capacity={cab.capacity} />
          <Button
            size="sm"
            className="h-8"
            disabled={full || cab.status !== 'filling'}
            onClick={onJoin}
          >
            {full ? 'Full' : 'Join pool'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
