"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlarmClock, Anchor, BadgeCheck, IdCard, Info, LogOut, Mail, MapPin, Phone, Train as TrainIcon, User, UserRound, Wallet, X } from "lucide-react";
import { api, notifyAuthChange, useMe } from "@/lib/client";
import { cn } from "@/lib/utils";

/** Rounded brand tile — the logo image itself, like the app icon. */
export function LogoTile({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-20 w-20 rounded-2xl" : size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  return (
    <div className={cn(dims, "shrink-0 select-none overflow-hidden shadow-sm transition-transform hover:scale-105")}>
      <img src="/mireli-logo.svg" alt="Mi-Reli" className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * App header — sticky, blurred, phone-width. Logo tile + wordmark + subtitle
 * + account chip + Info button. Guests get a silent session on first visit;
 * the chip is where they sign in (same-details form) and accounts sign out.
 */
export function SiteHeader({ subtitle = "Mombasa Terminus" }: { subtitle?: string }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { me, refresh } = useMe();
  const isGuest = me?.passenger?.isGuest ?? true;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link href="/" aria-label="Mi-Reli home">
            <LogoTile />
          </Link>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight text-foreground">Mi-Reli</div>
            <div className="-mt-0.5 text-[10px] tracking-wide text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Account chip — guests sign in; accounts open their profile */}
          {me &&
            (isGuest ? (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1 rounded-full px-3 text-[11px]">
                <Link href="/login?next=/">
                  <UserRound className="h-3.5 w-3.5" /> Sign in
                </Link>
              </Button>
            ) : (
              <button
                onClick={() => setAccountOpen(true)}
                aria-label="Your account"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-105"
              >
                {(me.session?.name || "P").trim().charAt(0).toUpperCase()}
              </button>
            ))}
          <button
            onClick={() => setAboutOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="About Mi-Reli"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} />
      <AccountSheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        name={me?.session?.name || null}
        identifier={me?.session?.identifier || null}
        email={me?.passenger?.email || null}
        idNumber={me?.passenger?.idNumber || null}
        onSignedOut={() => {
          setAccountOpen(false);
          refresh();
        }}
      />
    </header>
  );
}

function AccountSheet({
  open,
  onOpenChange,
  name,
  identifier,
  email,
  idNumber,
  onSignedOut,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string | null;
  identifier: string | null;
  email: string | null;
  idNumber: string | null;
  onSignedOut: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth", { body: { step: "logout" } });
      notifyAuthChange();
    } finally {
      setBusy(false);
      onSignedOut();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <UserRound className="h-5 w-5 text-primary" /> Your account
          </SheetTitle>
          <SheetDescription>Book with these details on any device — they identify your account.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <div className="space-y-1.5 rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{name || "Passenger"}</span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            {identifier && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {identifier.replace("+254", "0")}
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {email}
              </div>
            )}
            {idNumber && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <IdCard className="h-3.5 w-3.5 shrink-0" /> ID/Passport · {idNumber}
              </div>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={signOut} disabled={busy}>
            <LogOut className="mr-1 h-4 w-4" /> {busy ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Passenger nav — the signature pill switcher (Book / My rides / Credits). */
export function SiteNav() {
  const pathname = usePathname();
  const { me } = useMe();

  const items = [
    { href: "/", label: "Book", icon: Anchor, active: pathname === "/" },
    { href: "/bookings", label: "My rides", icon: User, active: pathname === "/bookings" },
    {
      href: "/credits",
      label: me?.creditBalance ? `Credit · KSh ${me.creditBalance}` : "Credits",
      icon: Wallet,
      active: pathname === "/credits",
    },
  ];

  return (
    <div className="mx-auto max-w-md px-4 pb-2.5">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/50 p-1 backdrop-blur-sm">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-200",
              item.active
                ? "mireli-pill-active"
                : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-md px-4 py-2 text-center text-[10px] text-muted-foreground">
        Mi-Reli · Mombasa Terminus · every shilling tracked in the platform ledger
      </div>
    </footer>
  );
}

function AboutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Mi-Reli — about</SheetTitle>
          <SheetDescription>
            Reliable shared-ride shuttles connecting Mombasa Terminus (MTM) with the North &amp;
            South Coast — every cab timed to a Madaraka Express departure or arrival.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6 text-sm">
          <section className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-base font-semibold">
              <TrainIcon className="h-4 w-4" /> Trains we meet
            </h3>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Departures</span> (MTM → Nairobi): 08:00
              Inter-County, 15:00 Express, 22:00 Night Train
              <br />
              <span className="font-medium text-foreground">Arrivals</span> (Nairobi → MTM): 04:00
              (+1d Night Train), 14:00 Inter-County, 20:30 Express
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-base font-semibold">
              <AlarmClock className="h-4 w-4" /> Pickup rules
            </h3>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Every cab leaves its stage exactly <span className="font-medium text-foreground">2 hours before the train departs</span>{" "}
                (e.g. cabs for the 08:00 train pull out at 06:00) — be at your stage by then.
              </li>
              <li>
                The driver waits at most <span className="font-medium text-foreground">15 minutes</span> past
                departure if you haven&apos;t arrived and haven&apos;t notified them — after that the cab
                leaves and the no-show policy applies.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-base font-semibold">
              <MapPin className="h-4 w-4" /> Points &amp; fares
            </h3>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">North Coast (KSh 400):</span> Kiembeni
              Mwisho · Kiembeni Police · Ananda Marga · San Sera · Green Estate · Kona Kiembeni ·
              Bamburi Mwisho · Naivas Bamburi · Total Bamburi · Fisheries · Mwembeni · JCC Junction ·
              Nyali Center · VOK · Bombolulu · Lights · Mtwapa —{" "}
              <span className="font-medium text-foreground">Malindi KSh 700</span>
              <br />
              <span className="font-medium text-foreground">South Coast:</span> Likoni Ferry
              Container · Kona Mpya (Fayaz) · ShikaAdabu Checkpoint (KSh 400) —{" "}
              <span className="font-medium text-foreground">Diani Naivas KSh 500</span>
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-base font-semibold">How fares work</h3>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Per-seat fare by point — KSh 400 flat upcountry, Malindi 700, Diani Naivas 500.
              </li>
              <li>
                Door-to-door pickup adds the point&apos;s surcharge, which passes to your driver in
                full.
              </li>
              <li>Private charter: the whole cab to your group at a fixed route price.</li>
              <li>
                Cancel before lock for a full refund; cancel after lock and your fare becomes travel
                credit, valid 30 days.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-base font-semibold">Your money is safe</h3>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Fares are collected by Mi-Reli via M-Pesa — never paid to a driver directly.</li>
              <li>Every shilling sits in the platform ledger until your ride is delivered.</li>
              <li>Refunds go back to your M-Pesa; credits stay spendable on any future ride.</li>
            </ul>
          </section>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            <X className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
