'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeederStore } from '@/store/feeder-store';
import { STAGES, TRAINS } from '@/lib/feeder/seed';
import { computeETA, fmtETA, fmtDistance } from '@/lib/feeder/gps';
import {
  MapPin,
  Users,
  Navigation,
  Car,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DriverLiveTracking({ cabId }: { cabId: string }) {
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const driverPositions = useFeederStore(s => s.driverPositions);
  const startGpsSimulation = useFeederStore(s => s.startGpsSimulation);

  const cab = cabs.find(c => c.id === cabId);
  const driverPos = cabId ? driverPositions[cabId] : undefined;

  // Start GPS simulation when cab departs (must be before any early return)
  useEffect(() => {
    if (cab && cab.status === 'departed' && !driverPos) {
      startGpsSimulation(cabId);
    }
  }, [cab, cabId, driverPos, startGpsSimulation]);

  if (!cab) return null;

  const stage = STAGES.find(s => s.id === cab.stageId)!;
  const train = TRAINS.find(t => t.id === cab.trainId)!;
  const isEnRoute = !!driverPos && cab.status === 'departed';

  // Get all passengers waiting at this cab's stage (or assigned to this cab)
  const myBookings = bookings.filter(b => b.cabId === cabId && b.status !== 'cancelled');

  // Group by stage (for inbound, all pickups are at the cab's stage; for outbound, drop-offs are at different stages)
  const stageGroups = new Map<string, typeof myBookings>();
  for (const b of myBookings) {
    const sid = b.stageId || cab.stageId;
    if (!stageGroups.has(sid)) stageGroups.set(sid, []);
    stageGroups.get(sid)!.push(b);
  }

  if (!isEnRoute) {
    // Pre-departure view — show who's waiting at the stage
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" /> Passengers waiting
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="rounded-lg bg-secondary/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stage</span>
              <span className="font-medium">{stage.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Passengers</span>
              <span className="font-medium">{myBookings.length} booked</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seats reserved</span>
              <span className="font-medium">{myBookings.reduce((s, b) => s + b.seatsReserved, 0)}</span>
            </div>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {myBookings.map(b => {
              const pStage = STAGES.find(s => s.id === b.stageId);
              return (
                <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                      {b.passengerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {b.passengerName}
                        {b.seatsReserved > 1 && (
                          <span className="text-muted-foreground ml-1">({b.seatsReserved})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {pStage?.name ?? b.pickupPoint}
                      </div>
                    </div>
                  </div>
                  {b.hasTicket ? (
                    <Badge variant="secondary" className="text-[9px] h-4 shrink-0">e-ticket</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">needs ticket</Badge>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Radio className="w-3 h-3" />
            GPS tracking starts when you depart
          </div>
        </CardContent>
      </Card>
    );
  }

  // En-route view — live GPS map showing cab position and approaching stages
  return (
    <Card className="border-primary/30 overflow-hidden">
      <CardHeader className="pb-2 bg-primary/5">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-primary msafiri-live-dot" /> Live tracking
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">
            {Math.round(driverPos.speedKmh)} km/h
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Simulated map */}
        <div className="relative h-32 rounded-xl bg-gradient-to-br from-primary/5 to-accent/10 border overflow-hidden">
          {/* Route line */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1="10" y1="80" x2="90" y2="20"
              stroke="oklch(0.28 0.07 258)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.4"
            />
          </svg>
          {/* Stage marker (passenger waiting) */}
          <div className="absolute bottom-3 left-3 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-accent ring-2 ring-accent/30 msafiri-live-dot" />
            <span className="text-[8px] mt-0.5 text-muted-foreground max-w-[60px] truncate">{stage.name}</span>
          </div>
          {/* Cab marker (current position) */}
          <div
            className="absolute transition-all duration-1000 ease-linear"
            style={{
              left: `${10 + driverPos.routeProgress * 80}%`,
              top: `${80 - driverPos.routeProgress * 60}%`,
            }}
          >
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <Car className="w-3.5 h-3.5" />
            </div>
          </div>
          {/* Terminus marker */}
          <div className="absolute top-3 right-3 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-primary ring-2 ring-primary/30" />
            <span className="text-[8px] mt-0.5 text-muted-foreground">Terminus</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{cab.direction === 'inbound' ? stage.name : 'Terminus'}</span>
            <span>{Math.round(driverPos.routeProgress * 100)}%</span>
            <span>{cab.direction === 'inbound' ? 'Terminus' : stage.name}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full msafiri-accent-bar transition-all duration-1000 ease-linear"
              style={{ width: `${driverPos.routeProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Passengers waiting at destination stage */}
        {stageGroups.size > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {cab.direction === 'inbound' ? 'Picking up at' : 'Dropping off at'}
            </div>
            {Array.from(stageGroups.entries()).map(([sid, pax]) => {
              const pStage = STAGES.find(s => s.id === sid);
              const eta = computeETA(driverPos, pStage || stage, stage.travelMin);
              return (
                <div key={sid} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{pStage?.name ?? stage.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {pax.length} passenger{pax.length > 1 ? 's' : ''} · {pax.reduce((s, b) => s + b.seatsReserved, 0)} seats
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary tabular-nums">{fmtETA(eta.etaMin)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtDistance(eta.distanceKm)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Radio className="w-3 h-3 msafiri-live-dot" />
          Live GPS · updates every 3s (prototype) · 15s in production
        </div>
      </CardContent>
    </Card>
  );
}
