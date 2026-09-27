"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaySheet } from "@/components/pay-sheet";
import { api, useMe, type PassengerDetails } from "@/lib/client";
import { ksh, fmtTime } from "@/lib/format";
import { BadgeCheck, Crown, Home, Loader2, Lock, MapPin, Ticket as TicketIcon, TrainFront, UserRound, AlarmClock } from "lucide-react";
import { DotBadge, Stars } from "@/components/app/shared";

export interface Stage {
  id: string;
  name: string;
  order: number;
  fare: number;
  homeSurcharge: number;
}

export interface TrainInfo {
  name: string;
  mtmTime: string;
  ntmTime: string;
  eventKind: "departs_mtm" | "arrives_mtm";
}

export interface BookableTrip {
  id: string;
  routeId: string;
  routeName: string;
  durationMinutes: number;
  charterPrice: number;
  direction: string;
  departureAt: string;
  terminusAt: string;
  train: TrainInfo | null;
  status: string;
  capacity: number;
  seatsLeft: number;
  bookable: boolean;
  stages: Stage[];
  pointsLabel: "drop-off" | "pickup";
  minFare: number;
  driver: { name: string; plate: string; cabType: string; rating: number } | null;
}

/** Everything the main view collected before the sheet opens. */
export interface BookingDraft {
  trip: BookableTrip;
  stageId: string;
  seats: number;
  charter: boolean;
  homePickup: boolean;
  homeAddress: string;
  useCredit: boolean;
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
    passengerName: string | null;
    passengerPhone: string | null;
    trip: {
      departureAt: string;
      routeName: string;
      driver: { name: string; plate?: string | null; phone?: string | null } | null;
    } | null;
  };
}

/** Details typed on this device prefill the next booking AND the account
 *  form — the exact same details create/sign into a Mireli account. */
const GUEST_KEY = "mireli.guest";

type StoredDetails = Partial<PassengerDetails> & { name?: string };

function loadStoredDetails(): StoredDetails {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/** Loose client-side checks mirroring the server's validators. */
function isValidMpesaPhone(input: string): boolean {
  const d = input.replace(/\D/g, "");
  return /^(?:254|0)?(?:7|1)\d{8}$/.test(d);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENDERS = ["Male", "Female", "Other"];

function detailsComplete(d: PassengerDetails): boolean {
  return (
    d.fullName.trim().length >= 2 &&
    d.idNumber.trim().length >= 4 &&
    d.nationality.trim().length >= 3 &&
    GENDERS.includes(d.gender) &&
    EMAIL_RE.test(d.email.trim()) &&
    isValidMpesaPhone(d.phone)
  );
}

export function BookingSheet({
  open,
  onClose,
  draft,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  draft: BookingDraft | null;
  onBooked: () => void;
}) {
  const { refresh } = useMe();
  const [homeAddress, setHomeAddress] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse["booking"] | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const { me } = useMe();
  const meRef = useRef(me);
  meRef.current = me;
  const creditBalance = me?.creditBalance || 0;
  const isGuest = me?.passenger?.isGuest ?? true;
  const [details, setDetails] = useState<PassengerDetails>({
    fullName: "",
    idNumber: "",
    nationality: "Kenyan",
    gender: "",
    email: "",
    phone: "",
  });

  function setDetail<K extends keyof PassengerDetails>(key: K, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  useEffect(() => {
    if (open && draft) {
      setHomeAddress(draft.homeAddress || "");
      setUseCredit(draft.useCredit);
      setError(null);
      setCreated(null);
      setPayOpen(false);
      // Prefill from the signed-in profile (guests included — their guest
      // record is stamped with the details they booked with), falling back
      // to whatever was last typed on this device.
      const p = meRef.current?.passenger;
      const stored = loadStoredDetails();
      const accountName =
        p?.name?.trim() && p.name.trim().toLowerCase() !== "guest" ? p.name.trim() : "";
      const accountPhone =
        p?.phone && !p.phone.startsWith("guest-") ? p.phone.replace("+254", "0") : "";
      setDetails({
        fullName: accountName || stored.fullName || stored.name || "",
        idNumber: p?.idNumber || stored.idNumber || "",
        nationality: p?.nationality || stored.nationality || "Kenyan",
        gender: p?.gender || stored.gender || "",
        email: p?.email || stored.email || "",
        phone: accountPhone || stored.phone || "",
      });
    }
  }, [open, draft]);

  const trip = draft?.trip;
  const stage = useMemo(() => trip?.stages.find((s) => s.id === draft?.stageId), [trip, draft?.stageId]);

  const fare = trip ? (draft?.charter ? trip.charterPrice : (stage?.fare || 0) * (draft?.seats || 1)) : 0;
  const surcharge = draft?.homePickup ? (draft?.charter ? stage?.homeSurcharge || 0 : (stage?.homeSurcharge || 0) * (draft?.seats || 1)) : 0;
  const total = fare + surcharge;
  const creditApplied = useCredit ? Math.min(creditBalance, total) : 0;
  const cashDue = total - creditApplied;
  const detailsOk = detailsComplete(details);
  // The guest rule, mirrored client-side: more than 1 seat (or a whole-cab
  // charter) needs an account. The API enforces this as the source of truth.
  const needsAccount = isGuest && (draft?.charter || (draft?.seats || 1) > 1);

  async function confirm() {
    if (!trip || !draft || !detailsOk || needsAccount) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<CreateResponse>("/api/bookings", {
        body: {
          routeId: trip.routeId,
          direction: trip.direction,
          stageId: draft.stageId,
          homePickup: draft.homePickup,
          homeAddress: draft.homePickup ? homeAddress : undefined,
          seats: draft.charter ? 1 : draft.seats,
          isCharter: draft.charter,
          applyCredit: useCredit && creditBalance > 0,
          travelDate: trip.departureAt.slice(0, 10),
          passengerName: details.fullName.trim(),
          passengerPhone: details.phone,
          passengerEmail: details.email.trim(),
          idNumber: details.idNumber.trim(),
          nationality: details.nationality.trim(),
          gender: details.gender,
        },
      });
      try {
        window.localStorage.setItem(GUEST_KEY, JSON.stringify(details));
      } catch {}
      setCreated(res.booking);
      await refresh();
      onBooked();
      if (res.booking.cashDue > 0) {
        setPayOpen(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  if (!trip || !draft) return null;

  const isCharter = draft.charter;

  return (
    <>
      <Sheet open={open && !payOpen} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <SheetTitle className="flex flex-wrap items-center gap-2 text-xl">
                  {trip.driver ? `${trip.driver.name}'s ${trip.driver.cabType}` : trip.routeName}
                  {isCharter && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-900">
                      <Crown className="h-3 w-3" /> Private charter
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                  {trip.driver && <Stars rating={trip.driver.rating} />}
                  {trip.driver && <span className="text-muted-foreground/50">•</span>}
                  {trip.driver && <span className="font-mono text-xs">{trip.driver.plate}</span>}
                  {trip.driver && <span className="text-muted-foreground/50">•</span>}
                  <DotBadge status={trip.status} />
                </SheetDescription>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {isCharter ? "Total fare" : draft.seats > 1 ? `${draft.seats} seats` : "Fare"}
                </div>
                <div className="text-2xl font-bold tabular-nums text-primary">{ksh(total)}</div>
                {!isCharter && draft.seats > 1 && (
                  <div className="text-[10px] text-muted-foreground">
                    {draft.seats} × {ksh(stage?.fare || 0)}
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          {created ? (
            <div className="space-y-4 px-4 pb-2">
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <TicketIcon className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold">Booking {created.code} placed!</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {created.cashDue > 0
                    ? `Karibu ${created.passengerName?.split(" ")[0] || ""} — complete the M-Pesa payment to confirm your seat.`
                    : `Karibu ${created.passengerName?.split(" ")[0] || ""} — fully covered by your travel credit, your seat is confirmed.`}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
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
                  No cash moves until your ride is delivered — it all sits in the Mi-Reli ledger.
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={onClose}>
                {created.cashDue > 0 ? "Pay later from My rides" : "Done"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 px-4 pb-2">
              {/* Route info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-secondary/60 p-3">
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />{" "}
                    {draft.homePickup
                      ? trip.direction === "FROM_TERMINUS"
                        ? "Drop-off near"
                        : "Pickup near"
                      : trip.direction === "FROM_TERMINUS"
                        ? "Drop-off point"
                        : "Pickup point"}
                  </div>
                  <div className="font-medium">{stage?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {draft.homePickup ? "door-to-door" : "shared stage"} · {trip.routeName.includes("North") ? "North" : "South"} Coast
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/60 p-3">
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <TrainFront className="h-3 w-3" /> Train
                  </div>
                  <div className="font-medium">{trip.train?.name ?? "Shuttle"}</div>
                  <div className="text-xs text-muted-foreground">
                    {trip.direction === "FROM_TERMINUS"
                      ? `Meets · MTM ${trip.train?.mtmTime ?? fmtTime(trip.departureAt)}`
                      : `Catches · MTM ${trip.train?.mtmTime ?? fmtTime(trip.departureAt)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">Cab departs {fmtTime(trip.departureAt)}</div>
                </div>
              </div>

              {/* Stage arrival rule — cabs leave stages 2h before the train,
                  waiting at most 15 min for a silent passenger. */}
              {trip.direction === "TO_TERMINUS" && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    Be at <b>{stage?.name || "your stage"}</b> by <b>{fmtTime(trip.departureAt)}</b> — cabs leave exactly 2 hours before the train. The driver waits at most 15 minutes if you haven&apos;t arrived and haven&apos;t notified them; after that the seat travels without you.
                  </span>
                </div>
              )}

              {draft.homePickup && (
                <div className="space-y-1.5">
                  <Label htmlFor="draft-address" className="flex items-center gap-1 text-xs">
                    <Home className="h-3 w-3" /> Door-to-door address
                  </Label>
                  <Input
                    id="draft-address"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder="e.g. Near Naivas Bamburi, gate 2"
                    className="h-9"
                  />
                </div>
              )}

              {/* Primary Passenger — Personal Details + Contact Info */}
              {needsAccount ? (
                <div className="space-y-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                    <Lock className="h-4 w-4" /> Login required
                  </div>
                  <p className="text-xs text-amber-900">
                    You can only book up to 1 seat without logging in. Login to book more seats.
                  </p>
                  <Button asChild variant="outline" className="h-9 w-full border-amber-300 bg-white/60">
                    <Link href="/login?next=/">Login to book more seats</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1 text-xs">
                      <UserRound className="h-3 w-3" /> Primary Passenger
                    </Label>
                    {isGuest ? (
                      <span className="text-[10px] text-muted-foreground">booking as a guest</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                        <BadgeCheck className="h-3 w-3" /> from your account
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Personal Details
                    </div>
                    <Input
                      value={details.fullName}
                      onChange={(e) => setDetail("fullName", e.target.value)}
                      placeholder="Full Name"
                      className="h-9"
                      autoComplete="name"
                    />
                    <Input
                      value={details.idNumber}
                      onChange={(e) => setDetail("idNumber", e.target.value)}
                      placeholder="ID/Passport Number"
                      className="h-9"
                      autoComplete="off"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={details.nationality}
                        onChange={(e) => setDetail("nationality", e.target.value)}
                        placeholder="Nationality"
                        className="h-9"
                        autoComplete="country"
                      />
                      <Select value={details.gender} onValueChange={(v) => setDetail("gender", v)}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Contact Info
                    </div>
                    <Input
                      type="email"
                      value={details.email}
                      onChange={(e) => setDetail("email", e.target.value)}
                      placeholder="Email"
                      className="h-9"
                      autoComplete="email"
                      inputMode="email"
                    />
                    <Input
                      value={details.phone}
                      onChange={(e) => setDetail("phone", e.target.value)}
                      placeholder="Phone Number · 07XX XXX XXX"
                      inputMode="tel"
                      className="h-9"
                      autoComplete="tel"
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    We reach this number with the M-Pesa prompt and pickup updates; the name and ID
                    go on the seat list the driver sees.
                    {isGuest && (
                      <>
                        {" "}You can book <b>1 seat</b> as a guest —{" "}
                        <Link href="/login?next=/" className="underline">
                          login with the same details
                        </Link>{" "}
                        to book more.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Fare breakdown */}
              <div className="space-y-1.5 rounded-lg border bg-card p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{isCharter ? "Charter fare" : `Fare × ${draft.seats}`}</span>
                  <span className="font-medium tabular-nums">{ksh(fare)}</span>
                </div>
                {surcharge > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Door-to-door surcharge (to driver in full)</span>
                    <span className="font-medium tabular-nums">+{ksh(surcharge)}</span>
                  </div>
                )}
                {creditBalance > 0 && (
                  <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <Checkbox checked={useCredit} onCheckedChange={(v) => setUseCredit(v === true)} className="mt-0.5" />
                    <span className="text-emerald-900">
                      Use travel credit — {ksh(creditBalance)} available
                      <span className="block text-[10px] text-emerald-800">
                        Partial use supported — leftover stays as credit, valid 30 days.
                      </span>
                    </span>
                  </label>
                )}
                {creditApplied > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Travel credit applied</span>
                    <span className="font-medium tabular-nums">−{ksh(creditApplied)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">To pay now</span>
                  <span className="text-sm font-bold tabular-nums text-primary">
                    {cashDue > 0 ? ksh(cashDue) : "Nothing — credit covers it"}
                  </span>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {!created && (
            <SheetFooter className="px-4 pb-4">
              <Button
                className="h-11 w-full"
                disabled={busy || !draft.stageId || !detailsOk || needsAccount}
                onClick={confirm}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCharter ? (
                  `Book charter · ${ksh(total)}`
                ) : (
                  `Reserve ${draft.seats > 1 ? `${draft.seats} seats` : "seat"} · ${ksh(total)}`
                )}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

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
            passengerName: created.passengerName,
            passengerPhone: created.passengerPhone,
            driver: created.trip?.driver
              ? { name: created.trip.driver.name, plate: created.trip.driver.plate, phone: created.trip.driver.phone }
              : null,
          }}
          onPaid={onBooked}
        />
      )}
    </>
  );
}
