"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { BookingSheet, BookableTrip } from "@/components/booking-sheet";
import { TripStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, useMe } from "@/lib/client";
import { fmtTime, ksh } from "@/lib/format";
import {
  ArrowRightLeft,
  Banknote,
  CalendarDays,
  Car,
  Clock,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  TicketCheck,
} from "lucide-react";

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const { me, loading: meLoading } = useMe();
  const router = useRouter();
  const [direction, setDirection] = useState<"FROM_TERMINUS" | "TO_TERMINUS">("FROM_TERMINUS");
  const [date, setDate] = useState(todayStr());
  const [trips, setTrips] = useState<BookableTrip[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookableTrip | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadTrips = useCallback(async (dir: string, d: string) => {
    setLoading(true);
    try {
      const res = await api<{ trips: BookableTrip[] }>(`/api/trips?date=${d}&direction=${dir}`);
      setTrips(res.trips);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips(direction, date);
  }, []);

  function switchDirection(dir: "FROM_TERMINUS" | "TO_TERMINUS") {
    setDirection(dir);
    loadTrips(dir, date);
  }

  function book(trip: BookableTrip) {
    if (meLoading) return;
    if (!me?.session) {
      router.push("/login?next=book");
      return;
    }
    setSelected(trip);
    setSheetOpen(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-secondary/70 to-background">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
                <TicketCheck className="h-3.5 w-3.5" /> SGR feeder service · Mombasa
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Off the train, onto a cab that <span className="text-primary">actually shows up.</span>
              </h1>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                Mi-Reli connects the Miritini Terminus with stages across Mombasa — Likoni, CBD,
                Mtwapa and more. Book a seat or take the whole cab. Pay with M-Pesa; your fare is
                held safely until your ride is delivered.
              </p>
            </div>

            {/* Search */}
            <Card className="mt-8">
              <CardContent className="p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Direction</Label>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
                      <button
                        onClick={() => switchDirection("FROM_TERMINUS")}
                        className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                          direction === "FROM_TERMINUS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Terminus → Stage
                      </button>
                      <button
                        onClick={() => switchDirection("TO_TERMINUS")}
                        className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                          direction === "TO_TERMINUS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Stage → Terminus
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="travel-date" className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Travel date
                    </Label>
                    <Input
                      id="travel-date"
                      type="date"
                      min={todayStr()}
                      max={todayStr(2)}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full sm:w-auto" onClick={() => loadTrips(direction, date)}>
                      <Search className="h-4 w-4" /> Find rides
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Results */}
        <section className="mx-auto w-full max-w-5xl px-4 py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {searched ? "Departures" : "Today's departures"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {direction === "FROM_TERMINUS" ? "Miritini Terminus → your stage" : "your stage → Miritini Terminus"}
              </span>
            </h2>
          </div>

          {loading && (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          )}

          {!loading && trips && trips.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
                <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No departures left for this day</p>
                <p className="text-sm text-muted-foreground">Try another date — the schedule runs 06:00 to 18:00.</p>
              </CardContent>
            </Card>
          )}

          {!loading && trips && trips.length > 0 && (
            <div className="grid gap-3">
              {trips.map((t) => (
                <Card key={t.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-lg font-semibold">
                          <Clock className="h-4 w-4 text-primary" /> {fmtTime(t.departureAt)}
                        </span>
                        <TripStatusBadge status={t.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.routeName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {t.driver && (
                          <span className="inline-flex items-center gap-1">
                            <Car className="h-3.5 w-3.5" /> {t.driver.cabType} · {t.driver.plate}
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {t.driver.rating.toFixed(1)}
                          </span>
                        )}
                        <span>
                          {t.seatsLeft > 0 ? `${t.seatsLeft} seats left` : "Full"}
                          {t.status === "locked" ? " · lock passed — credits only" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{ksh(Math.min(...t.stages.map((s) => s.fare)))}+</p>
                        <p className="text-xs text-muted-foreground">per seat · charter {ksh(t.charterPrice)}</p>
                      </div>
                      <Button
                        onClick={() => book(t)}
                        disabled={!t.bookable}
                        size="sm"
                        className="min-w-28"
                      >
                        {t.bookable ? "Book a seat" : t.status === "locked" ? "Locked" : "Unavailable"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Trust / how money works */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3">
            <div className="flex gap-3">
              <Banknote className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">M-Pesa, held safely</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your fare goes to the Mi-Reli M-Pesa account — never straight to a driver. Every
                  shilling is tracked in the platform ledger until your ride is delivered.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Cancel with confidence</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cancel early for a full refund. Late but gave notice? Your fare becomes travel
                  credit — valid 30 days, never lost.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Stage or doorstep</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Meet the cab at any stage along the route, or add door-to-door pickup — the
                  surcharge goes to the driver in full.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <BookingSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          loadTrips(direction, date);
        }}
        trip={selected}
        onBooked={() => loadTrips(direction, date)}
      />
    </div>
  );
}
