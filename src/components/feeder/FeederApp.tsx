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
import { AdminView } from './AdminView';
import {
  Train as TrainIcon,
  User,
  Car,
  Info,
  X,
  Shield,
  Crown,
  Anchor,
  MapPin,
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

        {/* Role switcher — 3 roles */}
        <div className="mx-auto max-w-md px-4 pb-2.5">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary/60">
            <RoleButton active={role === 'passenger'} onClick={() => setRole('passenger')} icon={<User className="w-3.5 h-3.5" />} label="Passenger" />
            <RoleButton active={role === 'driver'} onClick={() => setRole('driver')} icon={<Car className="w-3.5 h-3.5" />} label="Driver" />
            <RoleButton active={role === 'admin'} onClick={() => setRole('admin')} icon={<Shield className="w-3.5 h-3.5" />} label="Admin" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto max-w-md w-full px-4 py-4">
        <AnimatePresence mode="wait">
          {role === 'passenger' && (
            <motion.div
              key="passenger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
            >
              <PassengerView />
            </motion.div>
          )}
          {role === 'driver' && (
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
          {role === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <AdminView />
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

function RoleButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all',
        active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
      )}
    >
      {icon} {label}
    </button>
  );
}

function AboutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const settings = useFeederStore(s => s.settings);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">SGR Feeder — about</SheetTitle>
          <SheetDescription>
            An end-to-end prototype covering passenger booking, driver dispatch, and admin monitoring
            of cab–passenger connections at the Mombasa Terminus.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 text-sm">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <TrainIcon className="w-4 h-4" /> Trains
            </h3>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Departures</span> (Mombasa → Nairobi): 08:00, 15:00, 22:00<br />
              <span className="font-medium text-foreground">Arrivals</span> (Nairobi → Mombasa): 04:00, 14:00, 20:30
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Stages (agreed SGR collection points)
            </h3>
            <p className="text-muted-foreground text-xs">
              <span className="font-medium text-foreground">South Coast:</span> Likoni Ferry Container · Fayaz (Kona Mpya) · ShikaAdabu (Checkpoint) · Kombani · Naivas Diani<br />
              <span className="font-medium text-foreground">North Coast:</span> Kimbeni · Mtambo · Mtwapa · Malindi (location TBD)
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-violet-600" /> Fare model
            </h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs">
              <li>Base fare <span className="font-medium text-foreground">KSh {settings.baseFareStage}</span> per seat for stage pickup (pooled)</li>
              <li>Off-stage: +<span className="font-medium text-foreground">KSh {settings.offStageSurchargePerKm}/km</span> beyond stage, capped at {settings.offStageMaxRadiusKm} km (beyond: "meet at nearest stage")</li>
              <li>Private charter: base × capacity × <span className="font-medium text-foreground">{settings.charterMultiplier}x</span> multiplier</li>
              <li>Nudge discount: {settings.nudgeDiscountPct}% off within {settings.nudgeWindowMin}m of cutoff</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <User className="w-4 h-4" /> Passenger side
            </h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs">
              <li>Pick a direction (to/from terminus), a train, and a stage</li>
              <li>Choose stage pickup or off-stage (with distance slider that affects fare live)</li>
              <li>Toggle "Book the whole vehicle" to switch to private charter</li>
              <li>Reserve a seat; see reverse-engineered leave time for departures</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <Car className="w-4 h-4" /> Driver side
            </h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs">
              <li>See manifest, fill threshold, accept/decline pooled requests</li>
              <li>Charter requests appear only if driver has no active pooled bookings</li>
              <li>Accepting a charter locks the cab — pooled requests hidden</li>
              <li>Start trip once threshold met (or charter accepted)</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Admin side (arrival monitoring)
            </h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs">
              <li><span className="font-medium">Arrivals tab</span>: per arriving train, see cabs positioned at each stage, waiting passengers, and coverage gaps</li>
              <li><span className="font-medium">Departures tab</span>: per departing train, cab fill status and threshold progress</li>
              <li><span className="font-medium">Stages tab</span>: full stage coverage map with inbound/outbound cab counts and gaps</li>
              <li><span className="font-medium">Charters tab</span>: all charter bookings and pending requests across the system</li>
              <li>Top alert surfaces coverage gaps (passengers waiting, no cab assigned)</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-1.5">
              <Anchor className="w-4 h-4 text-violet-600" /> Try it
            </h3>
            <ul className="text-muted-foreground space-y-1 list-disc pl-4 text-xs">
              <li><b>Admin → Arrivals → 14:00 train</b>: see Likoni cluster gap (Fayaz & ShikaAdabu have passengers, no cab)</li>
              <li><b>Passenger → From Terminus → 14:00</b>: toggle off-stage, drag distance slider past 3km cap</li>
              <li><b>Passenger → book charter</b>: see fare = 450 × capacity × 1.3</li>
              <li><b>Driver → charter request</b>: see the lockout confirmation flow</li>
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
