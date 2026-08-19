'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useFeederStore } from '@/store/feeder-store';
import { PassengerView } from './PassengerView';
import { DriverView } from './DriverView';
import {
  Train as TrainIcon,
  User,
  Car,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function FeederApp() {
  const role = useFeederStore(s => s.role);
  const setRole = useFeederStore(s => s.setRole);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="mx-auto max-w-md px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <TrainIcon className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">SGR Feeder</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">Mombasa Terminus</div>
            </div>
          </div>
          <button
            onClick={() => setAboutOpen(true)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
            aria-label="About"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Role switcher */}
        <div className="mx-auto max-w-md px-4 pb-2.5">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/60">
            <button
              onClick={() => setRole('passenger')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                role === 'passenger'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <User className="w-3.5 h-3.5" /> Passenger
            </button>
            <button
              onClick={() => setRole('driver')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                role === 'driver'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <Car className="w-3.5 h-3.5" /> Driver
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto max-w-md w-full px-4 py-4">
        <AnimatePresence mode="wait">
          {role === 'passenger' ? (
            <motion.div
              key="passenger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
            >
              <PassengerView />
            </motion.div>
          ) : (
            <motion.div
              key="driver"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              <DriverView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-2 text-center text-[10px] text-muted-foreground">
          SGR Feeder · interactive prototype · data is simulated
        </div>
      </footer>

      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}

function AboutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">About this prototype</SheetTitle>
          <SheetDescription>
            A working prototype of the SGR Feeder app — converts the informal "wait until full"
            stage mechanic into digital fill-up, with reverse-engineered trip timing.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 text-sm">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">The core problem</h3>
            <p className="text-muted-foreground">
              SGR cabs (4/7/11/14-seaters) can't leave the stage until they're full. Today, that depends
              on strangers showing up in real time — so the departure time is unpredictable, and that
              unpredictability eats into the check-in / ticketing / security buffer passengers need
              to catch their train.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">The fix: book until full</h3>
            <p className="text-muted-foreground">
              Each cab posts a trip tied to a specific train. Passengers reserve seats in advance.
              The driver sees the seat count fill virtually — "3 of 7 booked" — hours before anyone
              is physically at the stage. Once a cab hits 70% (or the cutoff arrives), departure locks
              in and everyone gets notified with the pickup time.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">Reverse-engineered leave time</h3>
            <p className="text-muted-foreground">
              The app works out, per route and per train, the latest time a cab can leave the pickup
              point and still get passengers to the train on time:
            </p>
            <pre className="bg-secondary/60 rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
{`latestLeave = trainDeparture
              - securityBuffer (15m)
              - ticketingBuffer (20m, skip if has e-ticket)
              - checkInBuffer (10m)
              - travelTime (peak-adjusted)`}
            </pre>
            <p className="text-muted-foreground">
              If a passenger already has their e-ticket, the ticketing buffer is skipped — they can
              leave 20 minutes later and still catch the same train.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">Return leg: dispersal matching</h3>
            <p className="text-muted-foreground">
              Getting to the terminus is many-to-one. The return leg is the opposite — one terminus,
              scattered destinations (Jomvu, Miritini, Nyali, Bamburi, CBD, Shanzu). The outbound side
              pools arriving passengers by zone so a cab fills up by destination instead of by waiting
              at a stage. Drivers are notified ahead of the train's arrival so they're positioned to pool.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">Try it</h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4">
              <li>Passenger side: pick the 15:00 train, reserve a seat, toggle "I have my e-ticket" to see the leave time shift.</li>
              <li>Driver side: see your manifest, accept incoming requests, watch the threshold fill up, start the trip.</li>
              <li>Switch direction to "From Terminus" to see outbound pooling.</li>
            </ul>
          </section>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
