"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { BookingStatusBadge, LedgerStatusBadge, TripStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { fmtDate, fmtDateTime, fmtTime, ksh } from "@/lib/format";
import { Ban, FastForward, Users } from "lucide-react";

interface ManifestLine {
  id: string;
  code: string;
  passenger: string | null;
  phone: string;
  stageName: string | null;
  seats: number;
  isCharter: boolean;
  status: string;
  fare: number;
  homeSurcharge: number;
  ledgerStatus: string | null;
}

interface AdminTrip {
  id: string;
  routeName: string;
  direction: string;
  departureAt: string;
  status: string;
  capacity: number;
  bookedSeats: number;
  lockReason: string | null;
  source: string;
  train: { name: string; mtmTime: string; ntmTime: string; eventKind: "departs_mtm" | "arrives_mtm" } | null;
  driver: { id: string; name: string; plate: string; phone: string; mpesaNumber: string } | null;
  manifest: ManifestLine[];
}

export default function AdminTrips() {
  const { toast } = useToast();
  const [day, setDay] = useState("0");
  const { data, refresh } = useAdminData<{ trips: AdminTrip[] }>(`/api/admin/trips?day=${day}`);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelTrip, setCancelTrip] = useState<AdminTrip | null>(null);
  const [busy, setBusy] = useState(false);

  async function advanceSim() {
    setBusy(true);
    try {
      const res = await api<{ tripsCreated: number; locked: number; departed: number; completed: number }>(
        "/api/admin/trips",
        { body: { action: "tick" } }
      );
      toast({
        title: "Ops tick complete",
        description: `${res.tripsCreated} created · ${res.locked} locked · ${res.departed} departed · ${res.completed} completed`,
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function fullSweep() {
    setBusy(true);
    try {
      const res = await api<{ tick: { completed: number }; recon: { recoveredPayments: number; completedRefunds: number }; batch: { completed: number } | null }>(
        "/api/admin/trips",
        { body: { action: "full_sweep" } }
      );
      toast({
        title: "Full sweep complete",
        description: `Reconciled: ${res.recon.recoveredPayments} payments recovered · payouts executed: ${res.batch?.completed ?? 0}`,
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancelTrip() {
    if (!cancelTrip) return;
    setBusy(true);
    try {
      const res = await api<{ message: string }>("/api/admin/trips", {
        body: { action: "cancel_trip", tripId: cancelTrip.id },
      });
      toast({ title: "Trip cancelled", description: res.message });
      setCancelTrip(null);
      refresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const dayLabel = (v: string) =>
    v === "all" ? "All" : v === "-1" ? "Yesterday" : v === "0" ? "Today" : v === "1" ? "Tomorrow" : `In ${v} days`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trips & allocation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-allocation places every booking on a departure. Trips lock at the cutoff or
            seat-fill threshold — that lock is the early/late refund boundary.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={advanceSim} disabled={busy}>
            <FastForward className="h-4 w-4" /> Advance ops tick
          </Button>
          <Button variant="outline" size="sm" onClick={fullSweep} disabled={busy}>
            Run full sweep
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border p-1 sm:w-fit">
        {["-1", "0", "1", "2", "all"].map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              day === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {(data?.trips || []).map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {fmtTime(t.departureAt)} · {t.direction === "FROM_TERMINUS" ? "Terminus → drop-off" : "Pickup → Terminus"}
                    </span>
                    <TripStatusBadge status={t.status} />
                    {t.source === "auto" && <Badge variant="outline">auto-created</Badge>}
                    {t.lockReason && <Badge variant="outline">locked: {t.lockReason === "cutoff" ? "refund cutoff" : "seat fill"}</Badge>}
                    {t.train && (
                      <Badge variant="secondary">
                        {t.direction === "FROM_TERMINUS"
                          ? `meets ${t.train.name} (arr MTM ${t.train.mtmTime})`
                          : `catches ${t.train.name} (dep MTM ${t.train.mtmTime})`}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.routeName} · {fmtDate(t.departureAt)} ·{" "}
                    {t.driver ? `${t.driver.name} (${t.driver.plate})` : "no driver"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {t.bookedSeats}/{t.capacity}
                  </span>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setCancelTrip(t); }} disabled={["completed", "cancelled"].includes(t.status)}>
                    <Ban className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {expanded === t.id && (
                <div className="mt-3 border-t pt-3">
                  {t.manifest.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings on this trip yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                            <th className="py-1.5 pr-3">Booking</th>
                            <th className="py-1.5 pr-3">Passenger</th>
                            <th className="py-1.5 pr-3">Stage</th>
                            <th className="py-1.5 pr-3">Seats</th>
                            <th className="py-1.5 pr-3">Fare</th>
                            <th className="py-1.5 pr-3">Booking</th>
                            <th className="py-1.5">Ledger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.manifest.map((m) => (
                            <tr key={m.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-3 font-mono text-xs">{m.code}</td>
                              <td className="py-1.5 pr-3">{m.passenger}</td>
                              <td className="py-1.5 pr-3">{m.stageName}{m.isCharter ? " · charter" : ""}</td>
                              <td className="py-1.5 pr-3">{m.seats}</td>
                              <td className="py-1.5 pr-3">{ksh(m.fare)}</td>
                              <td className="py-1.5 pr-3"><BookingStatusBadge status={m.status} /></td>
                              <td className="py-1.5">{m.ledgerStatus ? <LedgerStatusBadge status={m.ledgerStatus} /> : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {data && data.trips.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">No trips in this window.</CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!cancelTrip} onOpenChange={(v) => !v && setCancelTrip(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this trip?</DialogTitle>
            <DialogDescription>
              Platform-cancelled trips refund unboarded passengers in full, any timing. Passengers
              already boarded stay on the shortened trip and their fares proceed to the normal
              payout. This is audit-logged.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => setCancelTrip(null)}>
              Keep trip
            </Button>
            <Button className="flex-1 bg-destructive text-white hover:bg-destructive/90" onClick={confirmCancelTrip} disabled={busy}>
              Cancel trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
