'use client';

import { cn } from '@/lib/utils';
import { fmtDuration, fmtCountdown } from '@/lib/feeder/calc';
import type { TripTiming } from '@/lib/feeder/types';
import { Clock, Shield, Printer, Ticket, Car, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Visualizes the reverse-engineered "latest leave time" mechanic.
// Shows the breakdown: leave → travel → security → ticketing → check-in → train
export function TripTimingTimeline({ timing, hasTicket }: {
  timing: TripTiming; hasTicket: boolean;
}) {
  const totalMin = timing.travelMin + timing.totalBufferMin;
  // Width fractions
  const wTravel = (timing.travelMin / totalMin) * 100;
  const wSecurity = (timing.securityMin / totalMin) * 100;
  const wTicketing = (timing.ticketingMin / totalMin) * 100;
  const wCheckIn = (timing.checkInMin / totalMin) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest leave time</div>
          <div className="text-3xl font-bold tabular-nums text-primary">{timing.latestLeaveTime}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Train departs</div>
          <div className="text-2xl font-bold tabular-nums">{timing.trainDeparture}</div>
        </div>
      </div>

      {/* Timeline bar */}
      <div>
        <div className="flex h-8 rounded-lg overflow-hidden border border-border">
          <Segment pct={wTravel}    color="bg-teal-500"    icon={<Car className="w-3 h-3" />}     label={`${timing.travelMin}m`} />
          <Segment pct={wSecurity}  color="bg-amber-500"   icon={<Shield className="w-3 h-3" />}  label={`${timing.securityMin}m`} />
          {timing.ticketingMin > 0 && (
            <Segment pct={wTicketing} color="bg-orange-500" icon={<Printer className="w-3 h-3" />} label={`${timing.ticketingMin}m`} />
          )}
          <Segment pct={wCheckIn}   color="bg-violet-500"  icon={<Ticket className="w-3 h-3" />}  label={`${timing.checkInMin}m`} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>Leave pickup</span>
          <span>Train departure</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Legend color="bg-teal-500"    icon={<Car className="w-3 h-3" />}     label="Travel time" value={fmtDuration(timing.travelMin)} />
        <Legend color="bg-amber-500"   icon={<Shield className="w-3 h-3" />}  label="Security" value={fmtDuration(timing.securityMin)} />
        <Legend color="bg-orange-500"  icon={<Printer className="w-3 h-3" />} label="Ticketing" value={hasTicket ? 'skipped' : fmtDuration(timing.ticketingMin)} />
        <Legend color="bg-violet-500"  icon={<Ticket className="w-3 h-3" />}  label="Check-in" value={fmtDuration(timing.checkInMin)} />
      </div>

      <div className="rounded-lg bg-secondary/60 p-3 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total buffer (post-arrival)</span>
          <span className="font-semibold tabular-nums">{fmtDuration(timing.totalBufferMin)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Auto-lock cutoff</span>
          <span className="font-semibold tabular-nums">{timing.cutoffTime} ({fmtCountdown(timing.minutesUntilCutoff)})</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Seat fill</span>
          <span className="font-semibold tabular-nums">{Math.round(timing.fillPct * 100)}%</span>
        </div>
      </div>

      {timing.shouldNudge && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Cab is in the nudge window — fare dropped to fill last seats before cutoff at {timing.cutoffTime}.
          </span>
        </div>
      )}

      {timing.fillPct >= 0.7 && timing.minutesUntilCutoff <= 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Threshold reached and cutoff passed — cab is auto-locking for departure.</span>
        </div>
      )}
    </div>
  );
}

function Segment({ pct, color, icon, label }: {
  pct: number; color: string; icon: React.ReactNode; label: string;
}) {
  return (
    <div
      className={cn('flex items-center justify-center gap-1 text-white text-[10px] font-medium', color)}
      style={{ width: `${pct}%` }}
      title={label}
    >
      {pct >= 8 && icon}
      {pct >= 12 && <span className="tabular-nums">{label}</span>}
    </div>
  );
}

function Legend({ color, icon, label, value }: {
  color: string; icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-white', color)}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-muted-foreground truncate">{label}</div>
        <div className="font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// Compact countdown badge for use on cards
export function LeaveCountdownBadge({ timing }: { timing: TripTiming }) {
  const min = timing.minutesUntilLeave;
  let cls = 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (min < 0) cls = 'bg-red-100 text-red-900 border-red-200';
  else if (min < 30) cls = 'bg-amber-100 text-amber-900 border-amber-200';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
      cls,
    )}>
      <Clock className="w-3 h-3" />
      Leaves {fmtCountdown(min)}
    </span>
  );
}
