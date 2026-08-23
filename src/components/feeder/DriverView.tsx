'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { STAGES, TRAINS } from '@/lib/feeder/seed';
import {
  computeTripTiming, shouldAutoLock, nudgeFare, computeFare, canDriverAcceptCharter,
  fmtDuration, fmtCountdown,
} from '@/lib/feeder/calc';
import { useFeederStore } from '@/store/feeder-store';
import { TripTimingTimeline, LeaveCountdownBadge } from './TripTiming';
import { Stars, StatusBadge, CharterBadge, BookingKindBadge } from './Shared';
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
  Crown,
  Lock,
  Anchor,
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
  const acceptCharterRequest = useFeederStore(s => s.acceptCharterRequest);
  const declineRequest = useFeederStore(s => s.declineRequest);
  const startTrip = useFeederStore(s => s.startTrip);

  const { toast } = useToast();
  const [showTiming, setShowTiming] = useState(false);
  const [charterConfirm, setCharterConfirm] = useState<string | null>(null);

  // Active driver cab — find inbound + outbound
  const activeCab = cabs.find(c => c.id === activeDriverCabId)!;
  const myCabs = cabs.filter(c => c.driverName === activeCab.driverName);
  const inboundCab = myCabs.find(c => c.direction === 'inbound');
  const outboundCab = myCabs.find(c => c.direction === 'outbound');

  if (!inboundCab) return null;

  const route = STAGES.find(s => s.id === inboundCab.stageId)!;
  const train = TRAINS.find(t => t.id === inboundCab.trainId)!;
  const timing = computeTripTiming(inboundCab, route, train, settings, false);
  const fare = nudgeFare(inboundCab, timing, settings);
  const autoLock = shouldAutoLock(inboundCab, timing, settings);
  const fillPct = timing.fillPct;
  const thresholdMet = fillPct >= settings.minFillThreshold;

  const myBookings = bookings.filter(b => b.cabId === inboundCab.id && b.status !== 'cancelled');
  const charterBookings = myBookings.filter(b => b.kind === 'charter');
  const isCharterLocked = inboundCab.charterLocked;

  const pooledRequests = requests.filter(r =>
    r.status === 'pending' && r.kind === 'pooled' && r.direction === 'inbound',
  );
  const charterRequests = requests.filter(r =>
    r.status === 'pending' && r.kind === 'charter' && r.direction === 'inbound',
  );

  const outboundBookings = outboundCab
    ? bookings.filter(b => b.cabId === outboundCab.id && b.status !== 'cancelled')
    : [];

  // Charter acceptance check
  const charterCheck = canDriverAcceptCharter(inboundCab, bookings);

  function handleAccept(reqId: string) {
    acceptRequest(reqId, inboundCab.id);
    toast({ title: 'Request accepted', description: 'Passenger notified.' });
  }
  function handleDecline(reqId: string) {
    declineRequest(reqId);
    toast({ title: 'Request declined', variant: 'destructive' });
  }
  function handleCharterAccept(reqId: string) {
    acceptCharterRequest(reqId, inboundCab.id);
    setCharterConfirm(null);
    toast({
      title: 'Charter accepted',
      description: 'Cab locked for private booking. Pooled requests hidden.',
    });
  }
  function handleStartTrip() {
    startTrip(inboundCab.id);
    toast({
      title: 'Trip started',
      description: isCharterLocked
        ? `Private charter locked in. Safe ride.`
        : `Locked in ${inboundCab.bookedSeats} passengers. Safe ride to ${train.code}.`,
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
          sub={`${stats.chartersCompleted} charter${stats.chartersCompleted !== 1 ? 's' : ''}`}
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
      <Card className={cn(
        'overflow-hidden',
        isCharterLocked ? 'border-violet-400' : 'border-primary/30',
      )}>
        <CardHeader className={cn(
          'pb-3',
          isCharterLocked ? 'bg-violet-50' : 'bg-primary/5',
        )}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Navigation className="w-4 h-4" /> Next trip · {train.code} · {train.time}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>{route.name} → Terminus</span>
                <StatusBadge status={inboundCab.status} />
                {isCharterLocked && <CharterBadge locked />}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latest leave</div>
              <div className="text-xl font-bold tabular-nums text-primary">{timing.latestLeaveTime}</div>
              {!isCharterLocked && <LeaveCountdownBadge timing={timing} />}
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
                <CircleDollarSign className="w-3 h-3" /> Fare
              </div>
              <div className="font-medium">
                KSh {isCharterLocked
                  ? (inboundCab.baseFare * inboundCab.capacity * settings.charterMultiplier).toLocaleString()
                  : fare}
                {!isCharterLocked && fare < inboundCab.baseFare && (
                  <span className="ml-1 text-[10px] text-amber-700">nudged</span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Seats
              </div>
              <div className="font-medium">
                {inboundCab.bookedSeats}/{inboundCab.capacity} {isCharterLocked && '(charter)'}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Auto-lock cutoff
              </div>
              <div className="font-medium">{timing.cutoffTime}</div>
            </div>
          </div>

          {/* Threshold progress — hidden for charter */}
          {!isCharterLocked && (
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
          )}

          {/* Charter lockout notice */}
          {isCharterLocked && (
            <div className="rounded-lg bg-violet-50 border border-violet-300 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-violet-900">
                <Lock className="w-4 h-4" /> Charter lockout active
              </div>
              <p className="text-[11px] text-violet-800">
                You've committed to a private charter for this run. Pooled pickup requests are hidden from your queue —
                you cannot accept new pooled passengers for this trip.
              </p>
            </div>
          )}

          {/* Toggle detailed timing */}
          {!isCharterLocked && (
            <button
              onClick={() => setShowTiming(v => !v)}
              className="text-xs text-primary hover:underline w-full text-left"
            >
              {showTiming ? 'Hide' : 'Show'} how leave time is computed ↓
            </button>
          )}
          {showTiming && !isCharterLocked && (
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
              <span className="text-[11px] text-muted-foreground">
                {myBookings.length} {isCharterLocked ? 'charter' : 'passenger'}{myBookings.length !== 1 ? 's' : ''}
              </span>
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
                  className={cn(
                    'flex items-center justify-between gap-2 p-2 rounded-lg text-xs',
                    b.kind === 'charter' ? 'bg-violet-100 border border-violet-200' : 'bg-secondary/40',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0',
                      b.kind === 'charter' ? 'bg-violet-500 text-white' : 'bg-primary/15 text-primary',
                    )}>
                      {b.kind === 'charter' ? <Crown className="w-3 h-3" /> : b.passengerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {b.passengerName}
                        {b.kind === 'pooled' && b.seatsReserved > 1 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">({b.seatsReserved} seats)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {b.pickupPoint}
                        {b.pickupKind === 'off-stage' && b.offStageDistanceKm && (
                          <span className="text-amber-700">+{b.offStageDistanceKm}km</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium tabular-nums">KSh {b.farePaid}</span>
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
                </div>
              ))}
            </div>
          </div>

          {/* Start trip */}
          <Separator />
          <Button
            className="w-full h-11"
            disabled={inboundCab.status !== 'filling' || (!isCharterLocked && !thresholdMet && !autoLock.locked && timing.minutesUntilLeave > 0 && myBookings.length === 0)}
            onClick={handleStartTrip}
          >
            <Play className="w-4 h-4 mr-1" />
            {inboundCab.status !== 'filling'
              ? `Trip ${inboundCab.status}`
              : isCharterLocked
                ? `Start charter trip · ${inboundCab.bookedSeats} seats`
                : myBookings.length === 0
                  ? 'No passengers yet'
                  : !thresholdMet && !autoLock.locked
                    ? `Wait — ${Math.round(settings.minFillThreshold * 100)}% threshold not met`
                    : `Start trip · ${inboundCab.bookedSeats} passengers`}
          </Button>
          {!isCharterLocked && !thresholdMet && !autoLock.locked && inboundCab.status === 'filling' && myBookings.length > 0 && (
            <p className="text-[11px] text-center text-muted-foreground">
              You can override once {timing.cutoffTime} arrives ({fmtCountdown(timing.minutesUntilCutoff)}).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charter requests — shown ONLY if driver can accept (no pooled passengers) */}
      {!isCharterLocked && charterCheck.allowed && charterRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-violet-600" /> Charter requests
            </span>
            <Badge variant="secondary" className="text-[10px]">{charterRequests.length} pending</Badge>
          </h3>
          {charterRequests.map(req => (
            <CharterRequestCard
              key={req.id}
              req={req}
              onAccept={() => setCharterConfirm(req.id)}
              onDecline={() => handleDecline(req.id)}
            />
          ))}
        </div>
      )}

      {/* Pooled requests — hidden when charter locked */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Incoming pooled requests
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {isCharterLocked ? '0 (charter locked)' : `${pooledRequests.length} pending`}
          </Badge>
        </h3>

        {isCharterLocked && (
          <Card className="border-violet-200 bg-violet-50/40">
            <CardContent className="p-4 text-center">
              <Lock className="w-6 h-6 mx-auto text-violet-500 mb-1" />
              <p className="text-xs text-muted-foreground">
                Pooled requests are hidden while your cab is committed to a charter booking.
              </p>
            </CardContent>
          </Card>
        )}

        {!isCharterLocked && pooledRequests.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No pending pooled requests.
            </CardContent>
          </Card>
        )}

        {!isCharterLocked && pooledRequests.map(req => (
          <PooledRequestCard
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
              <Anchor className="w-4 h-4 text-violet-600" /> Return-leg positioning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs pt-0">
            <p className="text-muted-foreground">
              You're also signed up to pick up arriving passengers. Position at the terminus before the train arrives.
            </p>
            <div className="rounded-lg bg-card border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Drop-off stage</span>
                <span className="font-medium">
                  {STAGES.find(s => s.id === outboundCab.stageId)?.name}
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
              {outboundCab.charterLocked && (
                <div className="flex items-center gap-1 text-[10px] text-violet-700 pt-1">
                  <Crown className="w-3 h-3" /> Charter booked for return leg
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charter confirmation sheet */}
      <CharterConfirmSheet
        open={!!charterConfirm}
        onOpenChange={(v) => !v && setCharterConfirm(null)}
        req={charterRequests.find(r => r.id === charterConfirm) ?? null}
        cab={inboundCab}
        onConfirm={() => charterConfirm && handleCharterAccept(charterConfirm)}
      />
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

function PooledRequestCard({ req, onAccept, onDecline }: {
  req: ReturnType<typeof useFeederStore.getState>['requests'][0];
  onAccept: () => void; onDecline: () => void;
}) {
  const minutesAgo = Math.max(1, Math.round((Date.now() - req.createdAt) / 60 / 1000));
  const train = req.trainId ? TRAINS.find(t => t.id === req.trainId) : null;
  const stage = req.stageId ? STAGES.find(s => s.id === req.stageId) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{req.passengerName}</span>
                <BookingKindBadge kind={req.kind} />
                <span className="text-[10px] text-muted-foreground">{minutesAgo}m ago</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {req.pickupPoint}
                {stage && ` · ${stage.area}`}
                {req.pickupKind === 'off-stage' && req.offStageDistanceKm && (
                  <span className="text-amber-700 inline-flex items-center gap-0.5">
                    <span className="opacity-50">·</span> {req.offStageDistanceKm}km off-stage
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                <Badge variant="secondary" className="h-5">
                  {req.seatsRequested} seat{req.seatsRequested > 1 ? 's' : ''}
                </Badge>
                {train && (
                  <Badge variant="outline" className="h-5">
                    {train.code} · {train.time}
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

function CharterRequestCard({ req, onAccept, onDecline }: {
  req: ReturnType<typeof useFeederStore.getState>['requests'][0];
  onAccept: () => void; onDecline: () => void;
}) {
  const minutesAgo = Math.max(1, Math.round((Date.now() - req.createdAt) / 60 / 1000));
  const train = req.trainId ? TRAINS.find(t => t.id === req.trainId) : null;
  const stage = req.stageId ? STAGES.find(s => s.id === req.stageId) : null;
  const settings = useFeederStore(s => s.settings);
  const cabs = useFeederStore(s => s.cabs);
  const activeDriverCabId = useFeederStore(s => s.activeDriverCabId);
  const cab = cabs.find(c => c.id === activeDriverCabId)!;
  const fare = computeFare({
    settings, pickupKind: req.pickupKind, offStageDistanceKm: req.offStageDistanceKm,
    kind: 'charter', capacity: cab.capacity,
  });

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-violet-300 bg-violet-50/40">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Crown className="w-4 h-4 text-violet-600" />
                <span className="font-medium text-sm">{req.passengerName}</span>
                <BookingKindBadge kind={req.kind} />
                <span className="text-[10px] text-muted-foreground">{minutesAgo}m ago</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {req.pickupPoint}
                {stage && ` · ${stage.area}`}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                <Badge variant="secondary" className="h-5">
                  Whole {cab.cabType} · {cab.capacity} seats
                </Badge>
                {train && (
                  <Badge variant="outline" className="h-5">
                    {train.code} · {train.time}
                  </Badge>
                )}
              </div>
              <div className="mt-2 rounded-lg bg-card border border-violet-200 p-2 text-xs space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-violet-700">Charter payout</div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Base × {cab.capacity} seats</span>
                  <span className="font-medium">KSh {fare.subtotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Charter premium</span>
                  <span className="font-medium">+KSh {fare.charterPremium}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="font-medium">You earn</span>
                  <span className="font-bold text-primary">KSh {fare.total}</span>
                </div>
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Accepting locks your cab for private use — pooled requests will be hidden.</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="sm" className="h-8 w-20 bg-violet-600 hover:bg-violet-700" onClick={onAccept}>
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

function CharterConfirmSheet({ open, onOpenChange, req, cab, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  req: ReturnType<typeof useFeederStore.getState>['requests'][0] | null;
  cab: ReturnType<typeof useFeederStore.getState>['cabs'][0];
  onConfirm: () => void;
}) {
  const settings = useFeederStore(s => s.settings);
  if (!req || !cab) return null;
  const fare = computeFare({
    settings, pickupKind: req.pickupKind, offStageDistanceKm: req.offStageDistanceKm,
    kind: 'charter', capacity: cab.capacity,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl flex items-center gap-2">
            <Crown className="w-5 h-5 text-violet-600" /> Confirm charter
          </SheetTitle>
          <SheetDescription>
            You're committing to a private charter for {req.passengerName}. This will lock your cab and hide all pooled requests.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-3 text-sm">
          <div className="rounded-lg bg-secondary/60 p-3 space-y-1.5">
            <Row label="Passenger" value={req.passengerName} />
            <Row label="Pickup" value={req.pickupPoint} />
            <Row label="Vehicle" value={`${cab.cabType} · ${cab.plateNumber}`} />
            <Row label="Seats reserved" value={String(cab.capacity)} />
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-violet-700">Charter payout</div>
            <Row label={`Base × ${cab.capacity} seats`} value={`KSh ${fare.subtotal}`} />
            <Row label="Charter premium (30%)" value={`+KSh ${fare.charterPremium}`} />
            <Separator className="my-1" />
            <div className="flex items-center justify-between">
              <span className="font-medium">Total payout</span>
              <span className="text-lg font-bold text-primary tabular-nums">KSh {fare.total}</span>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1.5">
            <div className="font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> What happens when you confirm
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Your cab is marked as charter-locked</li>
              <li>All pending pooled requests are hidden from your queue</li>
              <li>You cannot accept new pooled passengers for this trip</li>
              <li>The passenger is notified and pays the charter fare</li>
            </ul>
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <Button className="w-full h-11 bg-violet-600 hover:bg-violet-700" onClick={onConfirm}>
            <Check className="w-4 h-4 mr-1" /> Confirm charter · KSh {fare.total}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
