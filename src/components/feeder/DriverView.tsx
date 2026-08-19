'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ROUTES, TRAINS } from '@/lib/feeder/seed';
import { computeTripTiming, shouldAutoLock, nudgeFare, fmtDuration, fmtCountdown } from '@/lib/feeder/calc';
import { useFeederStore } from '@/store/feeder-store';
import { TripTimingTimeline, LeaveCountdownBadge } from './TripTiming';
import { Stars, StatusBadge } from './Shared';
import {
  Wallet,
  Users,
  Star,
  TrendingUp,
  Play,
  Check,
  X,
  MapPin,
  Ticket as TicketIcon,
  Clock,
  Navigation,
  AlertTriangle,
  CircleDollarSign,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function DriverView() {
  const activeDriverCabId = useFeederStore(s => s.activeDriverCabId);
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const requests = useFeederStore(s => s.requests);
  const settings = useFeederStore(s => s.settings);
  const stats = useFeederStore(s => s.driverStats);
  const acceptRequest = useFeederStore(s => s.acceptRequest);
  const declineRequest = useFeederStore(s => s.declineRequest);
  const startTrip = useFeederStore(s => s.startTrip);

  const { toast } = useToast();
  const [showTiming, setShowTiming] = useState(false);

  // Active driver cab — find inbound + outbound
  const myCabs = cabs.filter(c => c.driverName === cabs.find(c2 => c2.id === activeDriverCabId)?.driverName);
  const inboundCab = myCabs.find(c => c.direction === 'inbound')!;
  const outboundCab = myCabs.find(c => c.direction === 'outbound');

  const route = ROUTES.find(r => r.id === inboundCab.routeId)!;
  const train = TRAINS.find(t => t.id === inboundCab.trainId)!;
  const timing = computeTripTiming(inboundCab, route, train, settings, false);
  const fare = nudgeFare(inboundCab, timing, settings);
  const autoLock = shouldAutoLock(inboundCab, timing, settings);
  const fillPct = timing.fillPct;
  const thresholdMet = fillPct >= settings.minFillThreshold;

  const myBookings = bookings.filter(b => b.cabId === inboundCab.id && b.status !== 'cancelled');
  const myRequests = requests.filter(r =>
    r.status === 'pending' &&
    r.direction === 'inbound' &&
    r.trainId === inboundCab.trainId,
  );

  const outboundBookings = outboundCab
    ? bookings.filter(b => b.cabId === outboundCab.id && b.status !== 'cancelled')
    : [];

  const projectedEarnings = inboundCab.currentFare * inboundCab.bookedSeats;

  function handleAccept(reqId: string) {
    acceptRequest(reqId, inboundCab.id);
    toast({ title: 'Request accepted', description: 'Passenger notified.' });
  }
  function handleDecline(reqId: string) {
    declineRequest(reqId);
    toast({ title: 'Request declined', variant: 'destructive' });
  }
  function handleStartTrip() {
    startTrip(inboundCab.id);
    toast({
      title: 'Trip started',
      description: `Locked in ${inboundCab.bookedSeats} passengers. Safe ride to ${train.code}.`,
    });
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Stats header */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={<Wallet className="w-4 h-4" />}
          label="Today"
          value={`KSh ${stats.todayEarningsKSh.toLocaleString()}`}
          sub={`+${projectedEarnings} pending`}
          subClass="text-amber-700"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Trips"
          value={String(stats.tripsCompleted)}
          sub={`${stats.seatsFilled}/${stats.seatsOffered} seats`}
        />
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Rating"
          value={stats.rating.toFixed(1)}
          sub="all-time"
        />
      </div>

      {/* Next trip — the active inbound cab */}
      <Card className="overflow-hidden border-primary/30">
        <CardHeader className="pb-3 bg-primary/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Navigation className="w-4 h-4" /> Next trip · {train.code}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{route.name} → Terminus</span>
                <StatusBadge status={inboundCab.status} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latest leave</div>
              <div className="text-xl font-bold tabular-nums text-primary">{timing.latestLeaveTime}</div>
              <LeaveCountdownBadge timing={timing} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {/* Trip summary grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Car className="w-3 h-3" /> Cab
              </div>
              <div className="font-medium">{inboundCab.cabType} · {inboundCab.plateNumber}</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <CircleDollarSign className="w-3 h-3" /> Fare (current)
              </div>
              <div className="font-medium">
                KSh {fare}
                {fare < inboundCab.baseFare && (
                  <span className="ml-1 text-[10px] text-amber-700">nudged</span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Seats
              </div>
              <div className="font-medium">{inboundCab.bookedSeats}/{inboundCab.capacity} booked</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Auto-lock cutoff
              </div>
              <div className="font-medium">{timing.cutoffTime}</div>
            </div>
          </div>

          {/* Threshold progress */}
          <div className="rounded-lg border p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fill threshold</span>
              <span className="font-medium">
                {Math.round(fillPct * 100)}% / {Math.round(settings.minFillThreshold * 100)}% to lock
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden relative">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  thresholdMet ? 'bg-emerald-500' : 'bg-amber-500',
                )}
                style={{ width: `${Math.min(100, fillPct * 100)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
                style={{ left: `${settings.minFillThreshold * 100}%` }}
              />
            </div>
            {autoLock.locked && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium pt-0.5">
                <AlertTriangle className="w-3 h-3" /> {autoLock.reason}
              </div>
            )}
          </div>

          {/* Toggle detailed timing */}
          <button
            onClick={() => setShowTiming(v => !v)}
            className="text-xs text-primary hover:underline w-full text-left"
          >
            {showTiming ? 'Hide' : 'Show'} how leave time is computed ↓
          </button>
          {showTiming && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-lg border bg-card p-3"
            >
              <TripTimingTimeline timing={timing} hasTicket={false} />
            </motion.div>
          )}

          {/* Manifest */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Passenger manifest
              </h4>
              <span className="text-[11px] text-muted-foreground">{myBookings.length} passengers</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {myBookings.length === 0 && (
                <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                  No passengers booked yet.
                </div>
              )}
              {myBookings.map(b => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                      {b.passengerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.passengerName}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {b.pickupPoint}
                      </div>
                    </div>
                  </div>
                  {b.hasTicket ? (
                    <Badge variant="secondary" className="text-[10px] h-5 gap-0.5">
                      <TicketIcon className="w-2.5 h-2.5" /> e-ticket
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-5">
                      needs ticket
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Start trip */}
          <Separator />
          <Button
            className="w-full h-11"
            disabled={
              inboundCab.status !== 'filling' ||
              (!thresholdMet && !autoLock.locked && timing.minutesUntilLeave > 0)
            }
            onClick={handleStartTrip}
          >
            <Play className="w-4 h-4 mr-1" />
            {inboundCab.status !== 'filling'
              ? `Trip ${inboundCab.status}`
              : !thresholdMet && !autoLock.locked
                ? `Wait — ${Math.round(settings.minFillThreshold * 100)}% threshold not met`
                : `Start trip · ${inboundCab.bookedSeats} passengers`}
          </Button>
          {!thresholdMet && !autoLock.locked && inboundCab.status === 'filling' && (
            <p className="text-[11px] text-center text-muted-foreground">
              You can override once {timing.cutoffTime} arrives ({fmtCountdown(timing.minutesUntilCutoff)}).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Incoming requests */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Incoming requests
          </span>
          <Badge variant="secondary" className="text-[10px]">{myRequests.length} pending</Badge>
        </h3>
        {myRequests.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No pending requests for this train.
            </CardContent>
          </Card>
        )}
        {myRequests.map(req => (
          <RequestCard
            key={req.id}
            req={req}
            onAccept={() => handleAccept(req.id)}
            onDecline={() => handleDecline(req.id)}
          />
        ))}
      </div>

      {/* Outbound positioning */}
      {outboundCab && (
        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-violet-600" /> Return-leg positioning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs pt-0">
            <p className="text-muted-foreground">
              You're also signed up to pick up arriving passengers. Position at the terminus before the train arrives.
            </p>
            <div className="rounded-lg bg-card border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Drop-off zone</span>
                <span className="font-medium">
                  {ROUTES.find(r => r.id === outboundCab.routeId)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Already pooled</span>
                <span className="font-medium">
                  {outboundBookings.length}/{outboundCab.capacity} passengers
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fare</span>
                <span className="font-medium">KSh {outboundCab.currentFare}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, subClass }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; subClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
        {sub && (
          <div className={cn('text-[10px] text-muted-foreground', subClass)}>{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestCard({ req, onAccept, onDecline }: {
  req: ReturnType<typeof useFeederStore.getState>['requests'][0];
  onAccept: () => void; onDecline: () => void;
}) {
  const minutesAgo = Math.max(1, Math.round((Date.now() - req.createdAt) / 60 / 1000));
  const train = req.trainId ? TRAINS.find(t => t.id === req.trainId) : null;
  const route = req.pickupPoint
    ? ROUTES.find(r => r.landmark === req.pickupPoint || r.name === req.pickupPoint)
    : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{req.passengerName}</span>
                <span className="text-[10px] text-muted-foreground">{minutesAgo}m ago</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {req.pickupPoint}
                {route && ` · ${route.name}`}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                <Badge variant="secondary" className="h-5">
                  {req.seatsRequested} seat{req.seatsRequested > 1 ? 's' : ''}
                </Badge>
                {train && (
                  <Badge variant="outline" className="h-5">
                    {train.code} · {train.departureTime}
                  </Badge>
                )}
                {req.hasTicket && (
                  <Badge variant="secondary" className="h-5 gap-0.5">
                    <TicketIcon className="w-2.5 h-2.5" /> e-ticket
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="sm" className="h-8 w-20" onClick={onAccept}>
                <Check className="w-3.5 h-3.5 mr-0.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-20" onClick={onDecline}>
                <X className="w-3.5 h-3.5 mr-0.5" /> Decline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
