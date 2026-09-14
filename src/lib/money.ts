import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import * as daraja from "@/lib/daraja";

/**
 * The money engine.
 *
 * Principle: money is collected into the platform's own M-Pesa shortcode first
 * — it never goes directly to a driver. Every shilling is tracked in the
 * ledger as exactly one of:
 *   held | driver_payable | commission_taken | refunded | partially_refunded
 *   | converted_to_credit | forfeited
 *
 * The admin never touches these flows — they are config-driven and automatic.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

export const NTSA_COMMISSION_CAP = 0.18;

export async function getConfig() {
  let cfg = await db.platformConfig.findUnique({ where: { id: "main" } });
  if (!cfg) {
    cfg = await db.platformConfig.create({ data: { id: "main" } });
  }
  return cfg;
}

// ─── Credits (travel vouchers — never cashed out) ────────────────────────────

export async function issueCredit(params: {
  passengerId: string;
  sourceBookingId?: string;
  amount: number;
  note?: string;
  validityDays: number;
}) {
  return db.credit.create({
    data: {
      passengerId: params.passengerId,
      sourceBookingId: params.sourceBookingId,
      amount: params.amount,
      initialAmount: params.amount,
      note: params.note,
      expiresAt: new Date(Date.now() + params.validityDays * 24 * 60 * 60 * 1000),
    },
  });
}

/** FIFO partial redemption across a passenger's active credits.
 *  Returns total applied; each credit is reduced (marked "redeemed" only once
 *  fully used). A credit is never cashed out — it only ever offsets fares. */
export async function applyCredits(
  passengerId: string,
  bookingId: string,
  needed: number
): Promise<number> {
  const credits = await db.credit.findMany({
    where: {
      passengerId,
      status: "active",
      amount: { gt: 0 },
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" }, // use soonest-expiring first
  });
  let applied = 0;
  for (const c of credits) {
    if (applied >= needed) break;
    const take = Math.min(c.amount, needed - applied);
    if (take <= 0) continue;
    const remaining = c.amount - take;
    await db.credit.update({
      where: { id: c.id },
      data: {
        amount: remaining,
        status: remaining <= 0 ? "redeemed" : "active",
        redeemedAt: remaining <= 0 ? new Date() : null,
        redeemedBookingId: bookingId,
      },
    });
    applied += take;
  }
  return applied;
}

/** Restore a credit portion when a booking that used credit is cancelled
 *  early or by the platform (the passenger gave notice / wasn't at fault). */
export async function restoreCredit(params: {
  passengerId: string;
  sourceBookingId: string;
  amount: number;
  validityDays: number;
  note: string;
}) {
  if (params.amount <= 0) return null;
  return issueCredit({
    passengerId: params.passengerId,
    sourceBookingId: params.sourceBookingId,
    amount: params.amount,
    note: params.note,
    validityDays: params.validityDays,
  });
}

export async function expireStaleCredits(): Promise<number> {
  const res = await db.credit.updateMany({
    where: { status: "active", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
  return res.count;
}

// ─── Fare collection → ledger ────────────────────────────────────────────────

/** On STK success callback: create the ledger entry with status = held.
 *  This is money sitting in the platform shortcode, not yet belonging to
 *  anyone. Credit-funded value is recorded alongside for full-fare tracking
 *  but only `cashAmount` ever moved through M-Pesa. */
export async function recordCollection(params: {
  bookingId: string;
  tripId: string | null;
  totalAmount: number;
  cashAmount: number;
  creditApplied: number;
  homeSurchargeAmount: number;
  mpesaReceipt: string | null;
}) {
  const existing = await db.ledgerEntry.findUnique({
    where: { bookingId: params.bookingId },
  });
  if (existing) return existing; // idempotent — never double-record a collection
  return db.ledgerEntry.create({
    data: {
      bookingId: params.bookingId,
      tripId: params.tripId,
      totalAmount: params.totalAmount,
      cashAmount: params.cashAmount,
      creditApplied: params.creditApplied,
      homeSurchargeAmount: params.homeSurchargeAmount,
      mpesaReceipt: params.mpesaReceipt,
      collectedAt: params.cashAmount > 0 ? new Date() : null,
      status: "held",
    },
  });
}

// ─── Refund tiers ────────────────────────────────────────────────────────────

export type RefundTier =
  | "early" // before trip lock → full cash refund
  | "late" // after lock, before departure → full fare converts to credit
  | "no_show" // never cancelled, never showed → forfeited
  | "platform_cancelled"; // platform/driver cancelled → full cash refund always

/** Resolves the tier from the booking/trip state + config (never hardcoded). */
export async function resolveRefundTier(bookingId: string): Promise<{
  tier: RefundTier | null;
  detail: string;
}> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { trip: true },
  });
  if (!booking) return { tier: null, detail: "Booking not found" };

  if (booking.status === "awaiting_payment")
    return { tier: null, detail: "Nothing collected yet — booking simply voids." };
  if (["cancelled", "completed", "no_show"].includes(booking.status))
    return { tier: null, detail: `Booking already ${booking.status}.` };

  const trip = booking.trip;
  if (!trip)
    return { tier: null, detail: "Booking not yet allocated to a trip — voids without refund." };

  if (trip.status === "cancelled")
    return { tier: "platform_cancelled", detail: "Trip was cancelled by the platform." };
  if (trip.status === "departed" || trip.status === "completed")
    return { tier: null, detail: "Trip already departed — cancellation window closed." };

  // Trip still pre-departure: lock state decides early vs late
  const locked = trip.status === "locked" || trip.lockedAt !== null;
  if (locked) return { tier: "late", detail: "Trip locked — late cancellation converts fare to credit." };
  return { tier: "early", detail: "Before lock — full cash refund." };
}

const REFUND_METHOD_WINDOW_MS = 24 * 60 * 60 * 1000; // Reversal works in a short window

/** Executes the cancellation outcome for a collected booking. */
export async function executeCancellation(params: {
  bookingId: string;
  actor: { id: string; name: string; role: "passenger" | "admin" | "system" };
  trigger:
    | "passenger_cancel"
    | "platform_cancel"
    | "trip_cancel_unboarded"
    | "admin_override"
    | "no_show_resolution";
  overrideAmount?: number; // admin_override partial refund
}): Promise<{ outcome: string; tier: RefundTier | null }> {
  const cfg = await getConfig();
  const booking = await db.booking.findUnique({
    where: { id: params.bookingId },
    include: { trip: true, ledgerEntry: true },
  });
  if (!booking) throw new Error("Booking not found");
  const entry = booking.ledgerEntry;

  // Nothing collected yet → just void the booking
  if (!entry) {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelTier: "early" },
    });
    await audit({
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      action: "booking.void_unpaid",
      entity: "booking",
      entityId: booking.id,
      metadata: { code: booking.code },
    });
    return { outcome: "voided_unpaid", tier: "early" };
  }

  let tier: RefundTier;
  if (params.trigger === "no_show_resolution") {
    tier = "no_show";
  } else if (params.trigger === "platform_cancel" || params.trigger === "trip_cancel_unboarded") {
    tier = "platform_cancelled";
  } else if (params.trigger === "admin_override") {
    tier = "late"; // override treated as a discretionary cash refund post-lock
  } else {
    const resolved = await resolveRefundTier(booking.id);
    if (!resolved.tier) throw new Error(resolved.detail);
    tier = resolved.tier;
  }

  const now = new Date();

  if (tier === "early" || tier === "platform_cancelled") {
    // Full cash refund — Reversal if inside the short window, else B2C
    const method =
      entry.collectedAt && now.getTime() - entry.collectedAt.getTime() < REFUND_METHOD_WINDOW_MS
        ? "reversal"
        : "b2c";
    const refund = await db.refundRecord.create({
      data: {
        ledgerEntryId: entry.id,
        bookingId: booking.id,
        amount: entry.cashAmount,
        creditRestored: entry.creditApplied,
        reason:
          tier === "platform_cancelled"
            ? "platform_cancelled"
            : "cancelled_early",
        method,
        status: "pending",
      },
    });

    if (entry.cashAmount > 0) {
      const result =
        method === "reversal"
          ? daraja.reversal({ transactionId: entry.mpesaReceipt || booking.code, amount: entry.cashAmount })
          : daraja.b2c({ receiverPhone: await passengerPhone(booking.passengerId), amount: entry.cashAmount });
      const ok = result.resultCode === daraja.RESULT_CODES.SUCCESS;
      await db.refundRecord.update({
        where: { id: refund.id },
        data: {
          status: ok ? "completed" : "failed",
          mpesaResultCode: result.resultCode,
          failureReason: ok ? null : result.resultDesc,
          completedAt: ok ? new Date() : null,
        },
      });
      await db.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          status: ok ? "refunded" : "partially_refunded",
          statusChangedAt: new Date(),
        },
      });
    } else {
      // Credit-only booking: no cash to move, ledger simply releases the hold
      await db.refundRecord.update({
        where: { id: refund.id },
        data: { status: "completed", mpesaResultCode: daraja.RESULT_CODES.SUCCESS, completedAt: new Date() },
      });
      await db.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: "refunded", statusChangedAt: new Date() },
      });
    }

    // Restore the credit portion (passenger gave notice / not at fault)
    await restoreCredit({
      passengerId: booking.passengerId,
      sourceBookingId: booking.id,
      amount: entry.creditApplied,
      validityDays: cfg.creditValidityDays,
      note: `Credit restored — refund on ${booking.code}`,
    });

    await db.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: now, cancelTier: tier },
    });
    await audit({
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      action: tier === "platform_cancelled" ? "money.platform_refund" : "money.refund_early",
      entity: "booking",
      entityId: booking.id,
      metadata: { code: booking.code, amount: entry.cashAmount, method, tier },
    });
    return { outcome: "refunded", tier };
  }

  if (tier === "late") {
    if (params.trigger === "admin_override") {
      // Discretionary cash refund by admin (disputes) — amount from params
      const amount = Math.min(params.overrideAmount ?? entry.cashAmount, entry.cashAmount);
      const refund = await db.refundRecord.create({
        data: {
          ledgerEntryId: entry.id,
          bookingId: booking.id,
          amount,
          reason: "admin_override",
          method: "b2c",
          status: "pending",
        },
      });
      const result = daraja.b2c({
        receiverPhone: await passengerPhone(booking.passengerId),
        amount,
      });
      const ok = result.resultCode === daraja.RESULT_CODES.SUCCESS;
      await db.refundRecord.update({
        where: { id: refund.id },
        data: {
          status: ok ? "completed" : "failed",
          mpesaResultCode: result.resultCode,
          failureReason: ok ? null : result.resultDesc,
          completedAt: ok ? new Date() : null,
        },
      });
      // Commission reversal is proportional — the platform never keeps a
      // commission on a refunded fare.
      const cfgC = await getConfig();
      const commissionReversed = Math.round(amount * cfgC.commissionRate);
      const driverClawback = amount - commissionReversed;
      await db.refundRecord.update({
        where: { id: refund.id },
        data: { commissionReversed, driverClawback },
      });
      await db.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          status: amount >= entry.cashAmount ? "refunded" : "partially_refunded",
          statusChangedAt: new Date(),
        },
      });
      await db.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled", cancelledAt: now, cancelTier: "late" },
      });
      await audit({
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorRole: params.actor.role,
        action: "money.admin_override_refund",
        entity: "booking",
        entityId: booking.id,
        metadata: { code: booking.code, amount, commissionReversed, driverClawback },
      });
      return { outcome: "admin_refund", tier: "late" };
    }

    // Passenger late cancellation: NO cash moves — full fare converts to a
    // travel credit. The money stays on the platform as a liability, not a
    // payout, and the passenger never loses it.
    await issueCredit({
      passengerId: booking.passengerId,
      sourceBookingId: booking.id,
      amount: entry.totalAmount, // full fare: cash + credit portions
      note: `Late cancellation of ${booking.code} — fare saved as credit`,
      validityDays: cfg.creditValidityDays,
    });
    await db.ledgerEntry.update({
      where: { id: entry.id },
      data: { status: "converted_to_credit", statusChangedAt: new Date() },
    });
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: now, cancelTier: "late" },
    });
    await audit({
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      action: "money.late_cancel_to_credit",
      entity: "booking",
      entityId: booking.id,
      metadata: {
        code: booking.code,
        creditIssued: entry.totalAmount,
        validDays: cfg.creditValidityDays,
      },
    });
    return { outcome: "converted_to_credit", tier: "late" };
  }

  // no_show — reached only via the completion engine
  await db.booking.update({
    where: { id: booking.id },
    data: { status: "no_show", cancelTier: "no_show" },
  });
  await db.ledgerEntry.update({
    where: { id: entry.id },
    data: { status: "forfeited", statusChangedAt: new Date() },
  });
  await audit({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorRole: params.actor.role,
    action: "money.no_show_forfeit",
    entity: "booking",
    entityId: booking.id,
    metadata: { code: booking.code, amount: entry.totalAmount },
  });
  return { outcome: "forfeited", tier: "no_show" };
}

async function passengerPhone(passengerId: string): Promise<string> {
  const p = await db.passenger.findUnique({ where: { id: passengerId } });
  return p?.phone || "";
}

// ─── Trip completion → payout records ────────────────────────────────────────

/** Fires when a trip is COMPLETED (service delivered) — never at booking,
 *  never at lock. Creates one payout record per booking manifest line. */
export async function onTripCompleted(tripId: string) {
  const cfg = await getConfig();
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { bookings: { include: { ledgerEntry: true, passenger: true } } },
  });
  if (!trip || trip.status === "completed") return;
  if (!trip.driverId) return; // nothing owed if no driver was ever assigned

  const now = new Date();

  for (const b of trip.bookings) {
    const entry = b.ledgerEntry;
    if (!entry) continue;

    if (b.status === "boarded" || b.status === "confirmed") {
      // Delivered passenger (confirmed-but-not-checked-in would have been
      // handled as no-show at departure; treat late check-ins as delivered).
      await db.booking.update({
        where: { id: b.id },
        data: { status: "completed" },
      });
      if (entry.status === "held") {
        await db.ledgerEntry.update({
          where: { id: entry.id },
          data: { status: "driver_payable", statusChangedAt: now },
        });

        const gross = entry.totalAmount;
        const homeSurcharge = entry.homeSurchargeAmount;
        // Home surcharge passes to the driver in full — it compensates their
        // detour and is NOT part of the commission base.
        const commissionBase = Math.max(gross - homeSurcharge, 0);
        const commission = Math.round(commissionBase * cfg.commissionRate);
        const net = gross - commission;

        const payout = await db.payoutRecord.create({
          data: {
            driverId: trip.driverId,
            tripId: trip.id,
            grossFareTotal: gross,
            commissionAmount: commission,
            homeSurchargeAmount: homeSurcharge,
            netPayoutAmount: net,
            method: "b2c",
            status: "queued",
          },
        });

        // instant_per_trip mode fires the B2C immediately
        if (cfg.payoutMode === "instant_per_trip") {
          await executePayout(payout.id);
        }
      }
    } else if (b.status === "confirmed") {
      // defensive: never checked in → no-show resolution
      await executeCancellation({
        bookingId: b.id,
        actor: { id: "system", name: "Ops Engine", role: "system" },
        trigger: "no_show_resolution",
      });
    }
    // cancelled / no_show bookings: ledger already terminal
  }

  await db.trip.update({
    where: { id: tripId },
    data: { status: "completed", completedAt: now },
  });
  await audit({
    actorId: "system",
    actorName: "Ops Engine",
    actorRole: "system",
    action: "trip.completed",
    entity: "trip",
    entityId: tripId,
    metadata: { payoutsCreated: true },
  });
}

/** Executes one queued payout via B2C. Failure flags for admin review —
 *  never silently retried against a possibly bad number. */
export async function executePayout(payoutId: string): Promise<boolean> {
  const payout = await db.payoutRecord.findUnique({
    where: { id: payoutId },
    include: { driver: true },
  });
  if (!payout || payout.status === "completed") return payout?.status === "completed";
  const result = daraja.b2c({
    receiverPhone: payout.driver.mpesaNumber,
    amount: payout.netPayoutAmount,
  });
  const ok = result.resultCode === daraja.RESULT_CODES.SUCCESS;
  await db.payoutRecord.update({
    where: { id: payout.id },
    data: {
      status: ok ? "completed" : "failed",
      mpesaResultCode: result.resultCode,
      failureReason: ok ? null : result.resultDesc,
      completedAt: ok ? new Date() : null,
    },
  });
  if (ok) {
    // The platform has now taken its commission and paid the driver —
    // the ledger line moves to its terminal bucket.
    await db.ledgerEntry.updateMany({
      where: { tripId: payout.tripId, status: "driver_payable" },
      data: { status: "commission_taken", statusChangedAt: new Date() },
    });
  } else {
    await audit({
      actorId: "system",
      actorName: "Ops Engine",
      actorRole: "system",
      action: "money.payout_failed",
      entity: "payout",
      entityId: payout.id,
      metadata: { driver: payout.driver.name, reason: result.resultDesc },
    });
  }
  return ok;
}

/** Scheduled payout run — weekly by default (mirrors Uber/Bolt in Kenya).
 *  Sums every queued payout per driver into ONE B2C transfer. */
export async function runPayoutBatch(
  actor: { id: string; name: string; role: "passenger" | "admin" | "system" }
): Promise<{ drivers: number; completed: number; failed: number }> {
  const queued = await db.payoutRecord.findMany({
    where: { status: "queued" },
    include: { driver: true },
  });
  const byDriver = new Map<string, typeof queued>();
  for (const p of queued) {
    const list = byDriver.get(p.driverId) || [];
    list.push(p);
    byDriver.set(p.driverId, list);
  }

  const batchId = `batch-${Date.now()}`;
  let completed = 0;
  let failed = 0;

  for (const [, records] of byDriver) {
    // Execute one representative record per driver with the SUM, but keep
    // per-trip records intact — mark each included record by batch result.
    const total = records.reduce((s, r) => s + r.netPayoutAmount, 0);
    const result = daraja.b2c({
      receiverPhone: records[0].driver.mpesaNumber,
      amount: total,
    });
    const ok = result.resultCode === daraja.RESULT_CODES.SUCCESS;
    for (const r of records) {
      await db.payoutRecord.update({
        where: { id: r.id },
        data: {
          status: ok ? "completed" : "failed",
          mpesaResultCode: result.resultCode,
          failureReason: ok ? null : result.resultDesc,
          batchId,
          completedAt: ok ? new Date() : null,
        },
      });
      if (ok) {
        await db.ledgerEntry.updateMany({
          where: { tripId: r.tripId, status: "driver_payable" },
          data: { status: "commission_taken", statusChangedAt: new Date() },
        });
        completed++;
      } else {
        failed++;
      }
    }
    if (!ok) {
      await audit({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "money.payout_batch_failure",
        entity: "driver",
        entityId: records[0].driverId,
        metadata: { driver: records[0].driver.name, total, reason: result.resultDesc },
      });
    }
  }

  await db.platformConfig.update({
    where: { id: "main" },
    data: { lastPayoutRunAt: new Date() },
  });
  await audit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "money.payout_batch_run",
    entity: "system",
    entityId: batchId,
    metadata: { drivers: byDriver.size, completed, failed },
  });
  return { drivers: byDriver.size, completed, failed };
}

/** Is the scheduled payout batch due? (weekly default, config-driven) */
export async function isPayoutBatchDue(): Promise<{ due: boolean; mode: string; note: string }> {
  const cfg = await getConfig();
  if (cfg.payoutMode === "instant_per_trip")
    return { due: false, mode: cfg.payoutMode, note: "Payouts fire instantly per trip completion." };
  const now = new Date();
  if (cfg.payoutMode === "daily") {
    const last = cfg.lastPayoutRunAt;
    const due = !last || now.getTime() - last.getTime() >= 20 * 60 * 60 * 1000;
    return { due, mode: "daily", note: due ? "Daily batch due." : "Already run today." };
  }
  // weekly
  const due = now.getUTCDay() === cfg.payoutDay;
  const last = cfg.lastPayoutRunAt;
  const alreadyThisWeek =
    last && now.getTime() - last.getTime() < 6 * 24 * 60 * 60 * 1000;
  return {
    due: due && !alreadyThisWeek,
    mode: "weekly",
    note: due
      ? alreadyThisWeek
        ? "Batch day — already ran this week."
        : "Weekly batch day (like Uber/Bolt in Kenya)."
      : `Runs on day ${cfg.payoutDay} of the week.`,
  };
}

// ─── Reconciliation sweep (the nightly job) ──────────────────────────────────

/** Never rely on the callback alone. This sweep resolves any booking left in
 *  an ambiguous state so a missed webhook never silently loses a passenger's
 *  paid seat or a driver's payout trigger. */
export async function runReconciliationSweep(
  actor: { id: string; name: string; role: "passenger" | "admin" | "system" }
) {
  const cfg = await getConfig();
  const now = new Date();
  const summary = {
    recoveredPayments: 0,
    failedPayments: 0,
    completedRefunds: 0,
    flaggedStuckRefunds: 0,
    expiredCredits: 0,
  };

  // 1. Ambiguous STK pushes older than the sweep threshold
  const cutoff = new Date(now.getTime() - cfg.sweepPendingMinutes * 60 * 1000);
  const ambiguous = await db.mpesaTransaction.findMany({
    where: { status: { in: ["stk_push_sent", "pending", "ambiguous"] }, createdAt: { lte: cutoff } },
  });
  for (const tx of ambiguous) {
    const statusResult = daraja.transactionStatus(tx.checkoutRequestId);
    const ok = statusResult.resultCode === daraja.RESULT_CODES.SUCCESS;
    if (ok && statusResult.mpesaReceipt) {
      await db.mpesaTransaction.update({
        where: { id: tx.id },
        data: {
          status: "confirmed",
          resultCode: statusResult.resultCode,
          resultDesc: statusResult.resultDesc,
          mpesaReceipt: statusResult.mpesaReceipt,
          confirmedAt: now,
        },
      });
      const applied = await confirmBookingPayment(tx.bookingId, {
        receipt: statusResult.mpesaReceipt,
        checkoutRequestId: tx.checkoutRequestId,
      });
      if (applied) summary.recoveredPayments++;
    } else {
      await db.mpesaTransaction.update({
        where: { id: tx.id },
        data: { status: "failed", resultCode: daraja.RESULT_CODES.CANCELLED, resultDesc: "No confirmation — treated as cancelled" },
      });
      summary.failedPayments++;
    }
  }

  // 2. Refunds stuck in pending — give them a terminal state or flag
  const pendingRefunds = await db.refundRecord.findMany({ where: { status: "pending" } });
  for (const r of pendingRefunds) {
    const stuck = now.getTime() - r.initiatedAt.getTime() > cfg.stuckRefundHours * 60 * 60 * 1000;
    if (stuck) {
      await db.refundRecord.update({
        where: { id: r.id },
        data: { stuckFlaggedAt: now },
      });
      summary.flaggedStuckRefunds++;
    }
  }
  // Prototype: sweep also completes pending reversals/b2c (simulated callback)
  const completable = await db.refundRecord.findMany({
    where: { status: "pending", stuckFlaggedAt: null },
    take: 20,
  });
  for (const r of completable) {
    // Prototype: the refund callback arrives — give it its terminal state.
    await db.refundRecord.update({
      where: { id: r.id },
      data: { status: "completed", mpesaResultCode: daraja.RESULT_CODES.SUCCESS, completedAt: now },
    });
    await db.ledgerEntry.update({
      where: { id: r.ledgerEntryId },
      data: { status: "refunded", statusChangedAt: now },
    });
    summary.completedRefunds++;
  }

  // 3. Expire stale credits
  summary.expiredCredits = await expireStaleCredits();

  await db.platformConfig.update({
    where: { id: "main" },
    data: { lastReconciliationAt: now },
  });
  await audit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "money.reconciliation_sweep",
    entity: "system",
    entityId: "sweep",
    metadata: summary,
  });
  return summary;
}

// ─── Payment confirmation (shared by verify step + sweep) ────────────────────

export async function confirmBookingPayment(
  bookingId: string,
  tx: { receipt: string; checkoutRequestId: string }
): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ledgerEntry: true },
  });
  if (!booking) return false;
  if (booking.status === "awaiting_payment") {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "confirmed" },
    });
  }
  await recordCollection({
    bookingId: booking.id,
    tripId: booking.tripId,
    totalAmount: booking.fareAmount,
    cashAmount: booking.cashDue,
    creditApplied: booking.creditApplied,
    homeSurchargeAmount: booking.homeSurcharge,
    mpesaReceipt: tx.receipt,
  });
  await audit({
    actorId: booking.passengerId,
    actorName: "Passenger",
    actorRole: "passenger",
    action: "payment.confirm",
    entity: "booking",
    entityId: booking.id,
    metadata: { receipt: tx.receipt, amount: booking.cashDue },
  });
  return true;
}
