"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PaySheet } from "@/components/pay-sheet";
import { api, useMe } from "@/lib/client";
import { ksh, fmtTime } from "@/lib/format";
import { Car, CreditCard, Home, Loader2, MapPin, Users } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  order: number;
  fare: number;
  homeSurcharge: number;
}
export interface BookableTrip {
  id: string;
  routeId: string;
  routeName: string;
  durationMinutes: number;
  charterPrice: number;
  direction: string;
  departureAt: string;
  status: string;
  capacity: number;
  seatsLeft: number;
  stages: Stage[];
  driver: { name: string; plate: string; cabType: string; rating: number } | null;
}

interface CreateResponse {
  booking: {
    id: string;
    code: string;
    status: string;
    fareAmount: number;
    creditApplied: number;
    cashDue: number;
    stageName: string;
    allocationNote: string | null;
    trip: { departureAt: string; routeName: string; driver: { name: string } | null } | null;
  };
}

export function BookingSheet({
  open,
  onClose,
  trip,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  trip: BookableTrip | null;
  onBooked: () => void;
}) {
  const { me, refresh } = useMe();
  const [stageId, setStageId] = useState<string>("");
  const [seats, setSeats] = useState(1);
  const [charter, setCharter] = useState(false);
  const [homePickup, setHomePickup] = useState(false);
  const [homeAddress, setHomeAddress] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse["booking"] | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const creditBalance = me?.creditBalance || 0;

  useEffect(() => {
    if (open && trip) {
      // default: farthest stage (destination) for FROM_TERMINUS, else first stage
      const def = trip.direction === "FROM_TERMINUS" ? trip.stages[trip.stages.length - 1] : trip.stages[0];
      setStageId(def?.id || "");
      setSeats(1);
      setCharter(false);
      setHomePickup(false);
      setHomeAddress("");
      setUseCredit(false);
      setError(null);
      setCreated(null);
      setPayOpen(false);
    }
  }, [open, trip]);

  const stage = useMemo(() => trip?.stages.find((s) => s.id === stageId), [trip, stageId]);
  const fare = trip ? (charter ? trip.charterPrice : (stage?.fare || 0) * seats) : 0;
  const surcharge = homePickup ? (charter ? stage?.homeSurcharge || 0 : (stage?.homeSurcharge || 0) * seats) : 0;
  const total = fare + surcharge;
  const creditApplied = useCredit ? Math.min(creditBalance, total) : 0;
  const cashDue = total - creditApplied;

  async function confirm() {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<CreateResponse>("/api/bookings", {
        body: {
          routeId: trip.routeId,
          direction: trip.direction,
          stageId,
          homePickup,
          homeAddress: homePickup ? homeAddress : undefined,
          seats: charter ? 1 : seats,
          isCharter: charter,
          applyCredit: useCredit && creditBalance > 0,
          travelDate: trip.departureAt.slice(0, 10),
        },
      });
      setCreated(res.booking);
      await refresh();
      if (res.booking.cashDue > 0) {
        setPayOpen(true);
      }
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  if (!trip) return null;

  return (
    <>
      <Dialog open={open && !payOpen} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" aria-describedby="book-desc">
          {!created ? (
            <>
              <DialogHeader>
                <DialogTitle>Book your ride</DialogTitle>
                <DialogDescription id="book-desc">
                  {trip.routeName} · departs {fmtTime(trip.departureAt)} · {trip.seatsLeft} seats left
                  {trip.driver ? ` · ${trip.driver.name} (${trip.driver.plate})` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Private charter</p>
                      <p className="text-xs text-muted-foreground">The whole cab to yourself · {ksh(trip.charterPrice)}</p>
                    </div>
                  </div>
                  <Switch checked={charter} onCheckedChange={setCharter} aria-label="Book as private charter" />
                </div>

                {!charter && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" /> Seats
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setSeats(Math.max(1, seats - 1))} aria-label="Fewer seats">−</Button>
                      <span className="w-10 text-center text-lg font-semibold">{seats}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSeats(Math.min(trip.seatsLeft, seats + 1))}
                        aria-label="More seats"
                      >
                        +
                      </Button>
                      <span className="text-xs text-muted-foreground">max {trip.seatsLeft}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    {trip.direction === "FROM_TERMINUS" ? "Drop-off stage" : "Pickup stage"}
                  </Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger aria-label="Select stage">
                      <SelectValue placeholder="Choose your stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {trip.stages
                        .filter((s) => s.order > 0 || trip.direction === "TO_TERMINUS")
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} · {ksh(s.fare)}/seat
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Door-to-door pickup</p>
                        <p className="text-xs text-muted-foreground">
                          {stage ? `+${ksh(stage.homeSurcharge)}/seat — passes to the driver in full` : ""}
                        </p>
                      </div>
                    </div>
                    <Switch checked={homePickup} onCheckedChange={setHomePickup} aria-label="Home pickup" />
                  </div>
                  {homePickup && (
                    <Input
                      placeholder="Where should the cab pick you up?"
                      value={homeAddress}
                      onChange={(e) => setHomeAddress(e.target.value)}
                      aria-label="Home pickup address"
                    />
                  )}
                </div>

                {creditBalance > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <Checkbox
                      id="use-credit"
                      checked={useCredit}
                      onCheckedChange={(v) => setUseCredit(v === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="use-credit" className="font-medium">
                        Use travel credit — {ksh(creditBalance)} available
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Partial use supported — any leftover stays as credit for your next ride.
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{charter ? "Charter fare" : `Fare × ${seats}`}</span>
                    <span>{ksh(fare)}</span>
                  </div>
                  {surcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Home pickup surcharge</span>
                      <span>{ksh(surcharge)}</span>
                    </div>
                  )}
                  {creditApplied > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Travel credit applied</span>
                      <span>−{ksh(creditApplied)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>To pay now</span>
                    <span>{cashDue > 0 ? ksh(cashDue) : "Nothing — credit covers it"}</span>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button className="w-full" onClick={confirm} disabled={busy || !stageId}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : cashDue > 0 ? (
                    <>Continue to payment · {ksh(cashDue)}</>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" /> Confirm with credit
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-primary">Booking {created.code} placed</DialogTitle>
                <DialogDescription id="book-desc">
                  {created.trip?.departureAt
                    ? `Departs ${fmtTime(created.trip.departureAt)}`
                    : "Awaiting allocation"}{" "}
                  · {created.stageName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trip value</span>
                    <span className="font-medium">{ksh(created.fareAmount)}</span>
                  </div>
                  {created.creditApplied > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Paid with credit</span>
                      <span>−{ksh(created.creditApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">M-Pesa</span>
                    <span className="font-medium">{ksh(created.cashDue)}</span>
                  </div>
                  {created.allocationNote && (
                    <p className="mt-2 text-xs text-muted-foreground">{created.allocationNote}</p>
                  )}
                </div>
                {created.cashDue > 0 ? (
                  <Button className="w-full" onClick={() => setPayOpen(true)}>
                    Pay {ksh(created.cashDue)} with M-Pesa
                  </Button>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                    Fully covered by your credit — your seat is confirmed. No cash moves until your
                    ride is delivered.
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={onClose}>
                  {created.cashDue > 0 ? "Pay later from My bookings" : "Done"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {created && (
        <PaySheet
          open={payOpen}
          onClose={() => {
            setPayOpen(false);
            onClose();
          }}
          booking={{
            id: created.id,
            code: created.code,
            cashDue: created.cashDue,
            routeName: created.trip?.routeName,
            departureAt: created.trip?.departureAt,
            stageName: created.stageName,
          }}
          onPaid={() => {
            onBooked();
          }}
        />
      )}
    </>
  );
}
