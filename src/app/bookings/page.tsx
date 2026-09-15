"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { BookingStatusBadge } from "@/components/status-badges";
import { PaySheet } from "@/components/pay-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, useMe } from "@/lib/client";
import { fmtDateTime, fmtTime, ksh, TIER_LABELS } from "@/lib/format";
import {
  Banknote,
  CalendarClock,
  Car,
  CheckCircle2,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  Ticket,
  TicketX,
} from "lucide-react";

interface BookingRow {
  id: string;
  code: string;
  routeName: string | null;
  direction: string;
  stageName: string | null;
  homePickup: boolean;
  homeAddress: string | null;
  seats: number;
  isCharter: boolean;
  fareAmount: number;
  homeSurcharge: number;
  creditApplied: number;
  cashDue: number;
  status: string;
  cancelTier: string | null;
  createdAt: string;
  departureAt: string | null;
  tripStatus: string | null;
  driver: { name: string; plate: string; cabType: string } | null;
  allocationNote: string | null;
  checkedInAt: string | null;
  lockNote: string | null;
  ledger: { status: string; cash: number; credit: number; receipt: string | null } | null;
  canPay: boolean;
  canCancel: boolean;
  canCheckIn: boolean;
  refund: { amount: number; status: string; reason: string } | null;
}

interface TierQuote {
  code: string;
  tier: string | null;
  detail: string;
  cashDue: number;
  creditApplied: number;
  creditValidityDays: number;
  policy: Record<string, string>;
}

export default function BookingsPage() {
  const { me, loading: meLoading } = useMe();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [payFor, setPayFor] = useState<BookingRow | null>(null);
  const [cancelFor, setCancelFor] = useState<BookingRow | null>(null);
  const [quote, setQuote] = useState<TierQuote | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ bookings: BookingRow[] }>("/api/bookings");
      setBookings(res.bookings);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    if (me?.session) load();
    else if (!meLoading) setBookings([]);
  }, [me, meLoading, load]);

  async function openCancel(b: BookingRow) {
    setCancelFor(b);
    setQuote(null);
    try {
      const q = await api<TierQuote>(`/api/bookings/${b.id}`);
      setQuote(q);
    } catch {
      setQuote(null);
    }
  }

  async function confirmCancel() {
    if (!cancelFor) return;
    setCancelling(true);
    try {
      const res = await api<{ message: string }>(`/api/bookings/${cancelFor.id}`, {
        body: { action: "cancel" },
      });
      toast({ title: "Cancellation processed", description: res.message });
      setCancelFor(null);
      await load();
    } catch (e) {
      toast({ title: "Could not cancel", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  async function checkIn(b: BookingRow) {
    setCheckingIn(b.id);
    try {
      await api(`/api/bookings/${b.id}`, { body: { action: "checkin" } });
      toast({ title: "Checked in", description: "The driver will meet you at your pickup point." });
      await load();
    } catch (e) {
      toast({ title: "Check-in failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setCheckingIn(null);
    }
  }

  if (meLoading) return null;

  if (!me?.session) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Ticket className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Sign in to see your bookings</p>
          <Button asChild>
            <Link href="/login?next=/bookings">Sign in</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const upcoming = (bookings || []).filter((b) => ["awaiting_payment", "confirmed", "boarded"].includes(b.status));
  const past = (bookings || []).filter((b) => ["cancelled", "completed", "no_show"].includes(b.status));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">My bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your fare is held by the platform until your ride is delivered — never paid directly to a driver.
        </p>

        {bookings === null && (
          <div className="mt-6 grid gap-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        )}

        {bookings !== null && bookings.length === 0 && (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Ticket className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No bookings yet</p>
              <p className="text-sm text-muted-foreground">Find a departure and book your first seat.</p>
              <Button asChild>
                <Link href="/">Book a ride</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {upcoming.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            <div className="grid gap-3">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  b={b}
                  onPay={() => setPayFor(b)}
                  onCancel={() => openCancel(b)}
                  onCheckIn={() => checkIn(b)}
                  checkingIn={checkingIn === b.id}
                />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
            <div className="grid gap-3">
              {past.map((b) => (
                <PastCard key={b.id} b={b} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />

      {payFor && (
        <PaySheet
          open={!!payFor}
          onClose={() => {
            setPayFor(null);
            load();
          }}
          booking={{
            id: payFor.id,
            code: payFor.code,
            cashDue: payFor.cashDue,
            routeName: payFor.routeName,
            departureAt: payFor.departureAt,
            stageName: payFor.stageName,
          }}
          onPaid={load}
        />
      )}

      <AlertDialog open={!!cancelFor} onOpenChange={(v) => !v && setCancelFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelFor?.code}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {!quote && <Loader2 className="h-4 w-4 animate-spin" />}
                {quote && (
                  <>
                    <p className="rounded-md border bg-muted/40 p-3 text-sm">
                      <span className="font-semibold text-foreground">
                        {quote.tier ? TIER_LABELS[quote.tier] : quote.detail}
                      </span>
                      {quote.tier && (
                        <span className="mt-1 block text-muted-foreground">{quote.policy[quote.tier]}</span>
                      )}
                    </p>
                    {quote.tier === "late" && (
                      <p className="text-sm">
                        Your full fare of <strong>{ksh(quote.cashDue + quote.creditApplied)}</strong>{" "}
                        converts to travel credit valid <strong>{quote.creditValidityDays} days</strong>.
                        The money never leaves the platform and you never lose it.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my seat</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
              disabled={cancelling || !quote}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookingCard({
  b,
  onPay,
  onCancel,
  onCheckIn,
  checkingIn,
}: {
  b: BookingRow;
  onPay: () => void;
  onCancel: () => void;
  onCheckIn: () => void;
  checkingIn: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{b.code}</span>
              <BookingStatusBadge status={b.status} />
              {b.isCharter && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  Charter
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              {fmtDateTime(b.departureAt)}
              {b.tripStatus && <span className="text-muted-foreground">· trip {b.tripStatus}</span>}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {b.stageName}
              {b.homePickup && <Home className="h-3.5 w-3.5" />}
              {b.routeName ? ` · ${b.routeName}` : ""}
            </p>
            {b.driver && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Car className="h-4 w-4" /> {b.driver.name} · {b.driver.plate}
              </p>
            )}
            {b.allocationNote && !b.driver && (
              <p className="mt-0.5 text-xs text-muted-foreground">{b.allocationNote}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{ksh(b.fareAmount)}</p>
            {b.creditApplied > 0 && <p className="text-xs text-emerald-700">credit −{ksh(b.creditApplied)}</p>}
            {b.cashDue > 0 && b.status === "awaiting_payment" && (
              <p className="text-xs text-amber-700">{ksh(b.cashDue)} by M-Pesa</p>
            )}
          </div>
        </div>

        {b.lockNote && b.status === "confirmed" && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{b.lockNote}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {b.canPay && (
            <Button size="sm" onClick={onPay}>
              <CreditCard className="h-4 w-4" /> Pay {ksh(b.cashDue)} now
            </Button>
          )}
          {b.canCheckIn && (
            <Button size="sm" variant="outline" onClick={onCheckIn} disabled={checkingIn}>
              {checkingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              I&apos;m at the pickup point
            </Button>
          )}
          {b.canCancel && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancel}>
              <TicketX className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PastCard({ b }: { b: BookingRow }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{b.code}</span>
              <BookingStatusBadge status={b.status} />
              {b.cancelTier && (
                <span className="text-xs text-muted-foreground">{TIER_LABELS[b.cancelTier]}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtDateTime(b.departureAt || b.createdAt)} · {b.routeName || "Route"} · {b.stageName}
            </p>
            {b.ledger?.receipt && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">M-Pesa {b.ledger.receipt}</p>
            )}
            {b.refund && (
              <p className="mt-1 flex items-center gap-1 text-xs text-sky-900">
                <Banknote className="h-3.5 w-3.5" />
                Refund {ksh(b.refund.amount)} · {b.refund.status}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{ksh(b.fareAmount)}</p>
            {b.creditApplied > 0 && <p className="text-xs text-emerald-700">credit −{ksh(b.creditApplied)}</p>}
          </div>
        </div>
        {b.status === "no_show" && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-900">
            The seat was held and the driver went to the stage for it — the fare was forfeited per
            the cancellation policy.
          </p>
        )}
        {b.status === "cancelled" && b.cancelTier === "late" && (
          <p className="mt-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-900">
            Your fare was saved as travel credit — see the Credits page. Valid 30 days.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
