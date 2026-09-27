import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPassengerSession, isGuestPassenger, normalizePhone } from "@/lib/session";
import { audit } from "@/lib/audit";
import { applyCredits, getConfig, recordCollection } from "@/lib/money";
import { allocateBooking } from "@/lib/engine";
import { generateBookingCode, toMpesaMsISDN } from "@/lib/daraja";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENDERS = ["Male", "Female", "Other"];

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
      // Driver phone unlocks once the fare is settled (paid or credit-covered);
      // identity (name + plate) is visible from the start.
      driver:
        b.trip?.driver
          ? {
              name: b.trip.driver.name,
              plate: b.trip.driver.plate,
              cabType: b.trip.driver.cabType,
              phone: ["confirmed", "boarded", "completed"].includes(b.status) ? b.trip.driver.phone : null,
            }
          : null,
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
  const me = await db.passenger.findUnique({ where: { id: session.id } });
  if (!me) return NextResponse.json({ error: "Sign in to book" }, { status: 401 });
  const hasAccount = !isGuestPassenger(me);

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
    passengerName, // primary passenger — full details required for every booking
    passengerPhone, // doubles as the default M-Pesa number
    passengerEmail,
    idNumber,
    nationality,
    gender,
  } = body;

  // Primary passenger details (Personal Details + Contact Info). Everyone
  // fills these — guest or signed-in — so the driver's seat list identifies
  // who is actually travelling.
  const fullName = String(passengerName || "").trim();
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Enter the passenger's full name" }, { status: 400 });
  }
  const idNum = String(idNumber || "").trim();
  if (idNum.length < 4) {
    return NextResponse.json({ error: "Enter the passenger's ID/Passport number" }, { status: 400 });
  }
  const nat = String(nationality || "").trim();
  if (nat.length < 3) {
    return NextResponse.json({ error: "Enter the passenger's nationality" }, { status: 400 });
  }
  const gen = String(gender || "").trim();
  if (!GENDERS.includes(gen)) {
    return NextResponse.json({ error: "Select the passenger's gender" }, { status: 400 });
  }
  const email = String(passengerEmail || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const phone254 = toMpesaMsISDN(String(passengerPhone || ""));
  const phoneNorm = normalizePhone(String(passengerPhone || ""));
  if (!phone254 || !phoneNorm) {
    return NextResponse.json(
      { error: "Enter a valid M-Pesa number (07XX XXX XXX or 2547XX XXX XXX)" },
      { status: 400 },
    );
  }

  // Validate identifiers BEFORE touching Prisma — a missing/garbage id must be a
  // clean 400, never a 500 from a Prisma validation error.
  const routeIdStr = String(routeId ?? "").trim();
  if (!routeIdStr) {
    return NextResponse.json({ error: "Route is required" }, { status: 400 });
  }
  const travelDateDate =
    typeof travelDate === "string" && travelDate.trim() !== ""
      ? new Date(`${travelDate.trim()}T00:00:00`)
      : new Date();
  if (Number.isNaN(travelDateDate.getTime())) {
    return NextResponse.json({ error: "Invalid travel date" }, { status: 400 });
  }

  const cfg = await getConfig();
  const route = await db.route.findUnique({ where: { id: routeIdStr }, include: { stages: true } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 400 });
  const stage = route.stages.find((s) => s.id === stageId);
  if (!stage) return NextResponse.json({ error: "Pickup stage required" }, { status: 400 });
  if (homePickup && (!homeAddress || String(homeAddress).trim().length < 5)) {
    return NextResponse.json({ error: "Home pickup needs an address" }, { status: 400 });
  }

  const tripSeats = isCharter ? 0 : Math.max(1, Math.min(parseInt(seats, 10) || 1, 6));

  // THE GUEST RULE: up to 1 seat without an account. Charters (the whole cab)
  // count as more than one seat, so they need an account too.
  if (!hasAccount && (isCharter || tripSeats > 1)) {
    return NextResponse.json(
      {
        error: "You can only book up to 1 seat without logging in. Log in to book more seats.",
        requiresAccount: true,
      },
      { status: 403 },
    );
  }

  // Resolve the booking owner. A guest session books under its own record
  // (stamped with the provided details, so My rides shows the trip on this
  // device); if the phone already belongs to a real account the booking lands
  // in that account instead.
  let owner = me;
  if (!hasAccount) {
    const existing = await db.passenger.findUnique({ where: { phone: phoneNorm } });
    if (existing && existing.id !== me.id) {
      owner = existing;
    } else if (isGuestPassenger(me) && me.phone !== phoneNorm) {
      // Stamp the guest record with real contact details (first booking on
      // this device, or a follow-up booking with an updated number).
      owner = await db.passenger
        .update({
          where: { id: me.id },
          data: {
            phone: phoneNorm,
            name: fullName.slice(0, 80),
            email,
            idNumber: idNum,
            nationality: nat,
            gender: gen,
          },
        })
        .catch(() => me); // ultra-rare phone race — keep the guest record
    }
  } else {
    // Signed-in: never overwrite profile answers, just fill blanks.
    owner = await db.passenger.update({
      where: { id: me.id },
      data: {
        name: me.name || fullName.slice(0, 80),
        email: me.email || email,
        idNumber: me.idNumber || idNum,
        nationality: me.nationality || nat,
        gender: me.gender || gen,
      },
    });
  }

  const fare = isCharter ? route.charterPrice : stage.fare * tripSeats;
  const homeSurcharge = homePickup ? (isCharter ? stage.homeSurcharge : stage.homeSurcharge * tripSeats) : 0;
  const total = fare + homeSurcharge;

  const booking = await db.booking.create({
    data: {
      code: generateBookingCode(),
      passengerId: owner.id,
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
      passengerName: fullName.slice(0, 80),
      passengerPhone: phone254,
      passengerEmail: email.slice(0, 120),
      passengerIdNumber: idNum.slice(0, 40),
      passengerNationality: nat.slice(0, 60),
      passengerGender: gen,
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
  const allocation = await allocateBooking({
    bookingId: booking.id,
    routeId: route.id,
    direction,
    seats: isCharter ? 999 : tripSeats, // charter handled inside allocator
    travelDate: travelDateDate,
    charter: isCharter,
  });

  await audit({
    actorId: owner.id,
    actorName: owner.name || session.name,
    actorRole: "passenger",
    action: isCharter ? "booking.create.charter" : "booking.create",
    entity: "booking",
    entityId: booking.id,
    metadata: { code: booking.code, total, creditApplied, cashDue, allocation: allocation.note, passengerName: fullName, passengerPhone: phone254, bookedAsGuest: !hasAccount },
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
      actorId: owner.id,
      actorName: owner.name || session.name,
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
            driver: fresh!.trip.driver
              ? {
                  name: fresh!.trip.driver.name,
                  plate: fresh!.trip.driver.plate,
                  // Phone only once the fare is settled (e.g. credit-covered).
                  phone: ["confirmed", "boarded", "completed"].includes(fresh!.status)
                    ? fresh!.trip.driver.phone
                    : null,
                }
              : null,
          }
        : null,
      allocationNote: fresh!.allocationNote,
    },
    bookingWindowMinutes: cfg.bookingWindowMinutes,
  });
}
