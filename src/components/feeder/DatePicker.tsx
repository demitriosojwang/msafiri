'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fmtDateShort, isToday, isTomorrow, todayStr } from '@/lib/feeder/seed';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DatePicker({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedDate = (() => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function handleSelect(d: Date | undefined) {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${da}`);
    setOpen(false);
  }

  function quickTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${da}`);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(todayStr())}
        className={cn(
          'flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all',
          isToday(value)
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-card hover:bg-accent border-border',
        )}
      >
        Today
      </button>
      <button
        onClick={quickTomorrow}
        className={cn(
          'flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all',
          isTomorrow(value)
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-card hover:bg-accent border-border',
        )}
      >
        Tomorrow
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              !isToday(value) && !isTomorrow(value)
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card hover:bg-accent border-border',
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {!isToday(value) && !isTomorrow(value) ? fmtDateShort(value) : 'Pick date'}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={[{ before: today }]}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
