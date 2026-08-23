'use client';

import { Button } from '@/components/ui/button';
import { Minus, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SeatStepper({ value, min = 1, max = 14, onChange, available }: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  available?: number;  // available seats in selected cab; if provided, caps max
}) {
  const effectiveMax = available != null ? Math.min(max, available) : max;
  const canDec = value > min;
  const canInc = value < effectiveMax;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">Passengers</div>
          <div className="text-[11px] text-muted-foreground">
            {available != null
              ? `${available} seat${available !== 1 ? 's' : ''} available`
              : 'How many seats do you need?'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onChange(value - 1)}
          disabled={!canDec}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center border transition-all',
            canDec
              ? 'bg-background hover:bg-accent border-border active:scale-95'
              : 'bg-muted border-muted opacity-40 cursor-not-allowed',
          )}
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="w-10 text-center">
          <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
            {value === 1 ? 'seat' : 'seats'}
          </div>
        </div>
        <button
          onClick={() => onChange(value + 1)}
          disabled={!canInc}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center border transition-all',
            canInc
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary active:scale-95'
              : 'bg-muted border-muted opacity-40 cursor-not-allowed',
          )}
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
