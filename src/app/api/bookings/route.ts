import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPassengerSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { applyCredits, getConfig, recordCollection } from "@/lib/money";
import { allocateBooking } from "@/lib/engine";
import { generateBookingCode, toMpesaMsISDN } from "@/lib/daraja";

/** My bookings */
export async function GET() {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const bookings = await db.booking.findMany({
    where: { passengerId: session.id },
    orderBy: { createdAt: "desc" },
    include: {
      trip: { include: { route: true, driver: true } },
      ledgerEntry: true,
      refunds: true,
    },
  });
  const now = new Date();
  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      code: b.code,
      routeName: b.trip?.route.name || null,
      direction: b.direction,
      stageName: b.stageName,
      homePickup: b.homePickup,
      homeAddress: b.homeAddress,
      seats: b.seats,
      isCharter: b.isCharter,
      fareAmount: b.fareAmount,
      homeSurcharge: b.homeSurcharge,
      creditApplied: b.creditApplied,
      cashDue: b.cashDue,
      status: b.status,
      cancelTier: b.cancelTier,
      createdAt: b.createdAt,
      departureAt: b.trip?.departureAt || null,
      tripStatus: b.trip?.status || null,
      driver: b.trip?.driver ? { name: b.trip.driver.name, plate: b.trip.driver.plate, cabType: b.trip.driver.cabType } : null,
      allocationNote: b.allocationNote,
      passengerName: b.passengerName,
      passengerPhone: b.passengerPhone,
      checkedInAt: b.checkedInAt,
      lockNote:
        b.trip?.status === "locked"
          ? "Trip locked — cancelling now converts your fare to credit"
          : null,
      ledger: b.ledgerEntry
        ? { status: b.ledgerEntry.status, cash: b.ledgerEntry.cashAmount, credit: b.ledgerEntry.creditApplied, receipt: b.ledgerEntry.mpesaReceipt }
        : null,
      canPay: b.status === "awaiting_payment" && b.cashDue > 0,
      canCancel: ["awaiting_payment", "confirmed", "boarded"].includes(b.status) && b.trip?.status !== "departed" && b.trip?.status !== "completed",
      canCheckIn: b.status === "confirmed" && b.trip && ["scheduled", "locked"].includes(b.trip.status),
      refund: b.refunds.length ? { amount: b.refunds[0].amount, status: b.refunds[0].status, reason: b.refunds[0].reason } : null,
    })),
    now: now.toISOString(),
  });
}

/** Create a booking: fare → credit offer → allocation → payment stage. */
export async function POST(req: NextRequest) {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ error: "Sign in to book" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    routeId,
    direction = "FROM_TERMINUS",
    stageId,
    homePickup = false,
    homeAddress,
    seats = 1,
    isCharter = false,
    applyCredit = false,
    travelDate, // YYYY-MM-DD (the day the passenger wants to travel)
    passengerName, // guest checkout — no account needed
    passengerPhone, // doubles as the default M-Pesa number
  } = body;

  // Guest checkout details (Tahmeed-style): anyone can book and pay without
  // signing in — we just need to know who is travelling and how to reach them.
  const guestName = String(passengerName || "").trim();
  if (guestName.length < 2) {
    return NextResponse.json({ error: "Enter the passenger's full name" }, { status: 400 });
  }
  const guestPhone = toMpesaMsISDN(String(passengerPhone || ""));
  if (!guestPhone) {
    return NextResponse.json(
      { error: "Enter a valid M-Pesa number (07XX XXX XXX or 2547XX XXX XXX)" },
      { status: 400 },
    );
  }

  const cfg = await getConfig();
  const route = await db.route.findUnique({ where: { id: routeId }, include: { stages: true } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 400 });
  const stage = route.stages.find((s) => s.id === stageId);
  if (!stage) return NextResponse.json({ error: "Pickup stage required" }, { status: 400 });
  if (homePickup && (!homeAddress || String(homeAddress).trim().length < 5)) {
    return NextResponse.json({ error: "Home pickup needs an address" }, { status: 400 });
  }

  const tripSeats = isCharter ? 0 : Math.max(1, Math.min(parseInt(seats, 10) || 1, 6));
  const fare = isCharter ? route.charterPrice : stage.fare * tripSeats;
  const homeSurcharge = homePickup ? (isCharter ? stage.homeSurcharge : stage.homeSurcharge * tripSeats) : 0;
  const total = fare + homeSurcharge;

  const booking = await db.booking.create({
    data: {
      code: generateBookingCode(),
      passengerId: session.id,
      routeId: route.id,
      direction,
      stageId: stage.id,
      stageName: homePickup ? `Home pickup · ${stage.name} area` : stage.name,
      homePickup,
      homeAddress: homePickup ? String(homeAddress).slice(0, 200) : null,
      seats: isCharter ? 1 : tripSeats,
      isCharter,
      fareAmount: total, // total trip value (fare + home surcharge)
      homeSurcharge,
      creditApplied: 0,
      cashDue: total,
      status: "awaiting_payment",
      passengerName: guestName.slice(0, 80),
      passengerPhone: guestPhone,
    },
  });

  // Credit offer — the passenger chooses; partial use supported
  let creditApplied = 0;
  if (applyCredit) {
    creditApplied = await applyCredits(session.id, booking.id, total);
  }
  const cashDue = total - creditApplied;
  if (creditApplied > 0) {
    await db.booking.update({
      where: { id: booking.id },
      data: { creditApplied, cashDue },
    });
  }

  // Auto-allocation
  const travelDateDate = travelDate ? new Date(`${travelDate}T00:00:00`) : new Date();
  const allocation = await allocateBooking({
    bookingId: booking.id,
    routeId: route.id,
    direction,
    seats: isCharter ? 999 : tripSeats, // charter handled inside allocator
    travelDate: travelDateDate,
    charter: isCharter,
  });

  await audit({
    actorId: session.id,
    actorName: session.name,
    actorRole: "passenger",
    action: isCharter ? "booking.create.charter" : "booking.create",
    entity: "booking",
    entityId: booking.id,
    metadata: { code: booking.code, total, creditApplied, cashDue, allocation: allocation.note, passengerName: guestName, passengerPhone: guestPhone },
  });

  // Fully covered by credit? Confirm immediately — no cash ever moves.
  if (cashDue <= 0) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "confirmed" } });
    await recordCollection({
      bookingId: booking.id,
      tripId: allocation.tripId,
      totalAmount: total,
      cashAmount: 0,
      creditApplied,
      homeSurchargeAmount: homeSurcharge,
      mpesaReceipt: null,
    });
    await audit({
      actorId: session.id,
      actorName: session.name,
      actorRole: "passenger",
      action: "payment.credit_full",
      entity: "booking",
      entityId: booking.id,
      metadata: { code: booking.code, creditApplied },
    });
  }

  const fresh = await db.booking.findUnique({
    where: { id: booking.id },
    include: { trip: { include: { driver: true, route: true } } },
  });

  return NextResponse.json({
    ok: true,
    booking: {
      id: fresh!.id,
      code: fresh!.code,
      status: fresh!.status,
      fareAmount: fresh!.fareAmount,
      homeSurcharge: fresh!.homeSurcharge,
      creditApplied: fresh!.creditApplied,
      cashDue: fresh!.cashDue,
      stageName: fresh!.stageName,
      seats: fresh!.seats,
      isCharter: fresh!.isCharter,
      passengerName: fresh!.passengerName,
      passengerPhone: fresh!.passengerPhone,
      trip: fresh!.trip
        ? {
            id: fresh!.trip.id,
            departureAt: fresh!.trip.departureAt,
            status: fresh!.trip.status,
            routeName: fresh!.trip.route.name,
            driver: fresh!.trip.driver ? { name: fresh!.trip.driver.name, plate: fresh!.trip.driver.plate } : null,
          }
        : null,
      allocationNote: fresh!.allocationNote,
    },
    bookingWindowMinutes: cfg.bookingWindowMinutes,
  });
}
