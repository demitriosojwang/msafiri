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
  MapPinCheck,
  Search,
  ShieldCheck,
  Star,
  TrainFront,
} from "lucide-react";

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

interface TrainSchedule {
  id: string;
  name: string;
  direction: string;
  originCode: string;
  destCode: string;
  originTime: string;
  destTime: string;
  destDayOffset: number;
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
  const [trains, setTrains] = useState<TrainSchedule[]>([]);

  useEffect(() => {
    api<{ trains: TrainSchedule[] }>("/api/trains")
      .then((r) => setTrains(r.trains))
      .catch(() => {});
  }, []);

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
                <TrainFront className="h-3.5 w-3.5" /> SGR feeder · timed to every Madaraka Express
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Off the train, onto a cab that <span className="text-primary">actually shows up.</span>
              </h1>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                Mi-Reli shuttles you between Mombasa Terminus (MTM) and the coast — shared-ride
                pickup points across the North Coast (Kiembeni, Bamburi, Nyali, Mtwapa, Malindi)
                and the South Coast (Likoni, ShikaAdabu, Diani). Every cab is timed to a train
                departure or arrival. Pay with M-Pesa; your fare is held safely until your ride
                is delivered.
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
                        Train → drop-off
                      </button>
                      <button
                        onClick={() => switchDirection("TO_TERMINUS")}
                        className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                          direction === "TO_TERMINUS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Pickup → train
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
                {direction === "FROM_TERMINUS"
                  ? "Mombasa Terminus (MTM) → your drop-off point"
                  : "your pickup point → Mombasa Terminus (MTM)"}
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
                <p className="font-medium">No rides left for this day</p>
                <p className="text-sm text-muted-foreground">
                  Try another date — cabs run with every Madaraka Express departure and arrival
                  at Mombasa Terminus, including the night train.
                </p>
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
                        {t.train && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            <TrainFront className="h-3 w-3" />
                            {t.direction === "FROM_TERMINUS"
                              ? `Meets the ${t.train.name} · arrives MTM ${t.train.mtmTime}`
                              : `Catches the ${t.train.name} · departs MTM ${t.train.mtmTime}`}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {t.routeName}
                        {t.direction === "TO_TERMINUS"
                          ? ` · cab reaches the terminus ${fmtTime(t.terminusAt)}, ahead of the train`
                          : ` · ${t.stages.filter((s) => s.order > 0).length} drop-off points`}
                      </p>
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
                        <p className="text-lg font-bold text-primary">{ksh(t.minFare)}+</p>
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

        {/* Madaraka Express timetable — the trains every cab is timed to */}
        {trains.length > 0 && (
          <section className="border-t">
            <div className="mx-auto max-w-5xl px-4 py-8">
              <div className="flex items-center gap-2">
                <TrainFront className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">The trains we meet — Madaraka Express</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                MTM = Mombasa Terminus · NTM = Nairobi Terminus. Outbound cabs arrive at MTM
                before each departure; return cabs leave MTM after each arrival.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">Mombasa → Nairobi</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-1.5 pr-3">Train</th>
                        <th className="py-1.5 pr-3">Departs MTM</th>
                        <th className="py-1.5">Arrives NTM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trains
                        .filter((tr) => tr.direction === "MBA_TO_NBO")
                        .map((tr) => (
                          <tr key={tr.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-medium">{tr.name}</td>
                            <td className="py-1.5 pr-3">{tr.originTime}</td>
                            <td className="py-1.5">
                              {tr.destTime}
                              {tr.destDayOffset > 0 ? " (+1 day)" : ""}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">Nairobi → Mombasa</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-1.5 pr-3">Train</th>
                        <th className="py-1.5 pr-3">Departs NTM</th>
                        <th className="py-1.5">Arrives MTM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trains
                        .filter((tr) => tr.direction === "NBO_TO_MBA")
                        .map((tr) => (
                          <tr key={tr.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-medium">{tr.name}</td>
                            <td className="py-1.5 pr-3">{tr.originTime}</td>
                            <td className="py-1.5">
                              {tr.destTime}
                              {tr.destDayOffset > 0 ? " (+1 day)" : ""}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

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
              <MapPinCheck className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Pickup &amp; drop-off points</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share the ride from any of 22 coast points — Kiembeni to Mtwapa and Malindi up
                  north, Likoni to Diani down south. Returning by train? Choose your drop-off
                  point when you book.
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
