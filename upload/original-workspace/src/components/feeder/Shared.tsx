'use client';

import { cn } from '@/lib/utils';
import type { CabStatus, BookingKind } from '@/lib/feeder/types';

export function StatusBadge({ status }: { status: CabStatus }) {
  const map: Record<CabStatus, { label: string; cls: string; dotCls: string }> = {
    filling: { label: 'Filling', cls: 'bg-accent/15 text-accent border-accent/30', dotCls: 'bg-accent msafiri-live-dot' },
    locked: { label: 'Locked', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', dotCls: 'bg-emerald-500' },
    departed: { label: 'Departed', cls: 'bg-sky-100 text-sky-800 border-sky-200', dotCls: 'bg-sky-500' },
    arrived: { label: 'Arrived', cls: 'bg-violet-100 text-violet-800 border-violet-200', dotCls: 'bg-violet-500' },
  };
  const s = map[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border',
      s.cls,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dotCls)} />
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
        'flex-1 min-w-[110px] text-left px-3.5 py-2.5 rounded-2xl border transition-all duration-200',
        active
          ? 'msafiri-pill-active'
          : 'bg-card hover:bg-accent/10 border-border hover:border-accent/30 hover:shadow-sm',
      )}
    >
      <div className={cn(
        'text-[9px] uppercase tracking-wider font-medium',
        active ? 'opacity-80' : 'text-muted-foreground',
      )}>
        {direction === 'outbound' ? 'Arrives' : 'Departs'}
      </div>
      <div className="text-xl font-bold tabular-nums leading-tight mt-0.5">{time}</div>
      <div className={cn(
        'text-[10px] truncate mt-0.5',
        active ? 'opacity-80' : 'text-muted-foreground',
      )}>{code}</div>
    </button>
  );
}
