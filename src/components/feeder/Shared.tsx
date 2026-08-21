'use client';

import { cn } from '@/lib/utils';
import type { CabStatus, BookingKind } from '@/lib/feeder/types';

export function StatusBadge({ status }: { status: CabStatus }) {
  const map: Record<CabStatus, { label: string; cls: string }> = {
    filling: { label: 'Filling', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
    locked: { label: 'Locked', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
    departed: { label: 'Departed', cls: 'bg-sky-100 text-sky-900 border-sky-200' },
    arrived: { label: 'Arrived', cls: 'bg-violet-100 text-violet-900 border-violet-200' },
  };
  const s = map[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
      s.cls,
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}

export function CharterBadge({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-violet-100 text-violet-900 border-violet-300">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
      Charter locked
    </span>
  );
}

export function BookingKindBadge({ kind }: { kind: BookingKind }) {
  if (kind === 'charter') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-violet-50 text-violet-800 border-violet-200">
        Private charter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
      Pooled
    </span>
  );
}

export function SeatMeter({ booked, capacity, charterLocked }: { booked: number; capacity: number; charterLocked?: boolean }) {
  const pct = Math.min(100, Math.round((booked / capacity) * 100));
  const remaining = capacity - booked;
  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">Seats</span>
        <span className="font-semibold tabular-nums">{booked}/{capacity}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            charterLocked ? 'bg-violet-500' :
            pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">
        {charterLocked ? 'charter' : `${remaining} left`}
      </span>
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700">
      <span aria-hidden>★</span>
      <span className="font-medium tabular-nums">{rating.toFixed(1)}</span>
    </span>
  );
}

export function TrainPill({ code, time, active, onClick, direction }: {
  code: string; time: string; active: boolean; onClick?: () => void; direction?: 'inbound' | 'outbound';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 min-w-[110px] text-left px-3 py-2 rounded-xl border transition-all',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-card hover:bg-accent border-border',
      )}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-70">
        {direction === 'outbound' ? 'Arrives' : 'Departs'}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-tight">{time}</div>
      <div className="text-[10px] opacity-70 truncate">{code}</div>
    </button>
  );
}
