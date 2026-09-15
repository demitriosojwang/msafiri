import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPassengerSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  confirmBookingPayment,
  executeCancellation,
  resolveRefundTier,
} from "@/lib/money";
import * as daraja from "@/lib/daraja";

type Params = { params: Promise<{ id: string }> };

/** Refund-tier quote for the cancel dialog (policy is config-driven). */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { ledgerEntry: true, trip: true },
  });
  if (!booking || booking.passengerId !== session.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const cfg = await getConfigQuick();
  const { tier, detail } = await resolveRefundTier(id);
  return NextResponse.json({
    code: booking.code,
    tier,
    detail,
    cashDue: booking.cashDue,
    creditApplied: booking.creditApplied,
    creditValidityDays: cfg.creditValidityDays,
    policy: {
      early: "Full cash refund to your M-Pesa.",
      late: `No cash refund — your full fare converts to travel credit, valid ${cfg.creditValidityDays} days.`,
      no_show: "Fare forfeited — the seat was held and the driver went to the stage for it.",
      platform_cancelled: "Full cash refund always, regardless of timing.",
    },
  });
}

async function getConfigQuick() {
  const { getConfig } = await import("@/lib/money");
  return getConfig();
}

/** Booking actions: pay (STK push), verify, cancel, check-in. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const booking = await db.booking.findUnique({
    where: { id },
    include: { ledgerEntry: true, trip: true },
  });
  if (!booking || booking.passengerId !== session.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const actor = { id: session.id, name: session.name, role: "passenger" as const };

  // ── Pay: initiate STK push for the residual cash ──────────────────────────
  if (action === "pay") {
    if (booking.status !== "awaiting_payment" || booking.cashDue <= 0) {
      return NextResponse.json({ error: "Nothing to pay on this booking" }, { status: 400 });
    }
    const phoneRaw = String(body.phone || "");
    const { normalizePhone } = await import("@/lib/session");
    const phone = normalizePhone(phoneRaw);
    if (!phone) return NextResponse.json({ error: "Enter a valid M-Pesa number (07XX or 2547XX)" }, { status: 400 });

    // Idempotency: reuse a live push instead of double-charging
    const live = await db.mpesaTransaction.findFirst({
      where: { bookingId: booking.id, status: { in: ["pending", "stk_push_sent"] } },
      orderBy: { createdAt: "desc" },
    });
    if (live) {
      return NextResponse.json({ ok: true, checkoutRequestId: live.checkoutRequestId, amount: live.amount, phone: live.phone, reused: true });
    }

    const push = daraja.stkPush(phone, booking.cashDue, booking.code);
    const tx = await db.mpesaTransaction.create({
      data: {
        bookingId: booking.id,
        phone,
        amount: booking.cashDue,
        checkoutRequestId: push.checkoutRequestId,
        merchantRequestId: push.merchantRequestId,
        status: "stk_push_sent",
      },
    });
    await audit({
      actorId: session.id,
      actorName: session.name,
      actorRole: "passenger",
      action: "payment.initiate",
      entity: "booking",
      entityId: booking.id,
      metadata: { code: booking.code, amount: booking.cashDue, phone },
    });
    return NextResponse.json({ ok: true, checkoutRequestId: tx.checkoutRequestId, amount: booking.cashDue, phone });
  }

  // ── Verify: the customer acted on the prompt → result callback ───────────
  if (action === "verify") {
    const tx = await db.mpesaTransaction.findFirst({
      where: { bookingId: booking.id, status: { in: ["stk_push_sent", "pending"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!tx) {
      // Maybe already confirmed (sweep got there first)
      if (booking.status === "confirmed" && booking.ledgerEntry) {
        return NextResponse.json({ ok: true, alreadyConfirmed: true, receipt: booking.ledgerEntry.mpesaReceipt });
      }
      return NextResponse.json({ error: "No M-Pesa prompt is active — send one first" }, { status: 400 });
    }
    const result = daraja.confirmStkCallback();
    await db.mpesaTransaction.update({
      where: { id: tx.id },
      data: {
        status: "confirmed",
        resultCode: result.resultCode,
        resultDesc: result.resultDesc,
        mpesaReceipt: result.mpesaReceipt,
        confirmedAt: new Date(),
      },
    });
    await confirmBookingPayment(booking.id, {
      receipt: result.mpesaReceipt,
      checkoutRequestId: tx.checkoutRequestId,
    });
    const fresh = await db.booking.findUnique({ where: { id: booking.id }, include: { ledgerEntry: true } });
    return NextResponse.json({
      ok: true,
      receipt: result.mpesaReceipt,
      amount: booking.cashDue,
      status: fresh?.status,
      ledgerStatus: fresh?.ledgerEntry?.status,
    });
  }

  // ── Cancel: resolve the config-driven tier and execute ───────────────────
  if (action === "cancel") {
    if (!["awaiting_payment", "confirmed", "boarded"].includes(booking.status)) {
      return NextResponse.json({ error: "This booking can no longer be cancelled" }, { status: 400 });
    }
    if (booking.trip && ["departed", "completed"].includes(booking.trip.status)) {
      return NextResponse.json({ error: "Trip already departed — cancellation window closed" }, { status: 400 });
    }
    const result = await executeCancellation({ bookingId: booking.id, actor, trigger: "passenger_cancel" });
    const messages: Record<string, string> = {
      voided_unpaid: "Booking cancelled — nothing was collected.",
      refunded: "Full cash refund sent to your M-Pesa.",
      converted_to_credit: "Your fare is saved as travel credit for your next ride.",
      forfeited: "Fare forfeited.",
    };
    return NextResponse.json({ ok: true, ...result, message: messages[result.outcome] || result.outcome });
  }

  // ── Check in at the stage (prevents the no-show tier) ─────────────────────
  if (action === "checkin") {
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Only confirmed bookings can check in" }, { status: 400 });
    }
    if (booking.trip && ["departed", "completed", "cancelled"].includes(booking.trip.status)) {
      return NextResponse.json({ error: "Trip is no longer boarding" }, { status: 400 });
    }
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "boarded", checkedInAt: new Date() },
    });
    await audit({
      actorId: session.id,
      actorName: session.name,
      actorRole: "passenger",
      action: "booking.checkin",
      entity: "booking",
      entityId: booking.id,
      metadata: { code: booking.code },
    });
    return NextResponse.json({ ok: true, message: "Checked in — the driver will meet you at your pickup point." });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
