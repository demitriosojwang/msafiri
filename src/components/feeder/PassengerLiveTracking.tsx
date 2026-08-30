'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeederStore } from '@/store/feeder-store';
import { STAGES, TRAINS } from '@/lib/feeder/seed';
import { computeETA, fmtETA, fmtDistance } from '@/lib/feeder/gps';
import {
  Car,
  MapPin,
  Navigation,
  Radio,
  Clock,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function PassengerLiveTracking({ cabId }: { cabId: string }) {
  const cabs = useFeederStore(s => s.cabs);
  const driverPositions = useFeederStore(s => s.driverPositions);

  const cab = cabs.find(c => c.id === cabId);
  if (!cab) return null;

  const stage = STAGES.find(s => s.id === cab.stageId)!;
  const train = TRAINS.find(t => t.id === cab.trainId)!;
  const driverPos = driverPositions[cabId];
  const isEnRoute = !!driverPos && cab.status === 'departed';

  if (!isEnRoute) {
    // Cab hasn't departed yet — show the assigned driver + stage info
    return (
      <Card className="border-primary/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Car className="w-3.5 h-3.5" /> Your assigned cab
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{cab.driverName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-mono">{cab.plateNumber}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-amber-700">
                  <Star className="w-2.5 h-2.5" /> {cab.driverRating.toFixed(1)}
                </span>
                <span>·</span>
                <span>{cab.cabType}</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-card border p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pickup at</span>
              <span className="font-medium">{stage.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Train</span>
              <span className="font-medium">{train.code} · {train.time}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Clock className="w-3 h-3" />
            Driver will start tracking when they depart for your stage
          </div>
        </CardContent>
      </Card>
    );
  }

  // Cab is en route — show live ETA
  const eta = computeETA(driverPos, stage, stage.travelMin);

  return (
    <Card className="border-accent/30 overflow-hidden">
      <CardHeader className="pb-2 bg-accent/5">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-accent msafiri-live-dot" /> Your cab is on the way
          </span>
          <Badge variant="secondary" className="text-[9px] gap-0.5">
            <Radio className="w-2.5 h-2.5 msafiri-live-dot" /> LIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Big ETA display */}
        <div className="text-center py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Arriving in
          </div>
          <div className="text-4xl font-bold tabular-nums text-primary">
            {fmtETA(eta.etaMin)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {fmtDistance(eta.distanceKm)} away
          </div>
        </div>

        {/* Simulated map */}
        <div className="relative h-28 rounded-xl bg-gradient-to-br from-accent/5 to-primary/10 border overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1="10" y1="80" x2="90" y2="20"
              stroke="oklch(0.28 0.07 258)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.3"
            />
          </svg>
          {/* Your position (passenger) */}
          <div className="absolute bottom-3 left-3 flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-accent ring-2 ring-accent/30 flex items-center justify-center">
              <MapPin className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[8px] mt-0.5 text-muted-foreground font-medium">You</span>
          </div>
          {/* Cab marker */}
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
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Cab started</span>
            <span>{Math.round(driverPos.routeProgress * 100)}% complete</span>
            <span>Your stage</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full msafiri-accent-bar transition-all duration-1000 ease-linear"
              style={{ width: `${driverPos.routeProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Driver info */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Car className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{cab.driverName} · {cab.cabType}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{cab.plateNumber}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-0.5 text-amber-700 text-[11px]">
              <Star className="w-2.5 h-2.5" /> {cab.driverRating.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Radio className="w-3 h-3 msafiri-live-dot" />
          Live GPS · ETA is approximate · updates every 3s
        </div>
      </CardContent>
    </Card>
  );
}
