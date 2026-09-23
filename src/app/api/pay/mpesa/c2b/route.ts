import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmBookingPayment } from "@/lib/money";
import { resolveDaraja, RESULT_CODES, generateMpesaReceipt } from "@/lib/daraja";

/**
 * Safaricom Daraja → C2B confirmation webhook.
 *
 * This is what fires when a passenger pays the platform Pay Bill manually
 * (the "Pay bill" option in the Pay Sheet). BillRefNumber carries the Mi-Reli
 * booking code (the account number the passenger typed). An exact-amount
 * payment confirms the booking into the ledger; an underpayment is recorded
 * and surfaces in Admin → Reconciliation for a human decision.
 */
export async function POST(req: NextRequest) {
  const accepted = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      TransactionType?: string;
      TransID?: string;
      TransTime?: string;
      TransAmount?: string | number;
      BusinessShortCode?: string;
      BillRefNumber?: string;
      MSISDN?: string;
    };
    const transId = body.TransID;
    const billRef = (body.BillRefNumber || "").trim().toUpperCase();
    if (!transId || !billRef) return accepted;

    // Only accept confirmations for the configured shortcode (when one exists)
    const creds = await resolveDaraja();
    if (creds.shortcode && body.BusinessShortCode && String(body.BusinessShortCode) !== creds.shortcode) {
      await audit({
        actorId: "system",
        actorName: "Daraja C2B",
        actorRole: "system",
        action: "payment.c2b_ignored",
        entity: "booking",
        entityId: billRef,
        metadata: { reason: "short code mismatch", got: body.BusinessShortCode },
      });
      return accepted;
    }

    const booking = await db.booking.findUnique({ where: { code: billRef }, include: { ledgerEntry: true } });
    if (!booking) {
      // Unknown account — accept so Daraja stops retrying; flagged for recon.
      await audit({
        actorId: "system",
        actorName: "Daraja C2B",
        actorRole: "system",
        action: "payment.c2b_unknown_account",
        entity: "booking",
        entityId: billRef,
        metadata: { transId, amount: body.TransAmount, msisdn: body.MSISDN },
      });
      return accepted;
    }

    // Idempotent per M-Pesa receipt
    const existing = await db.mpesaTransaction.findUnique({ where: { checkoutRequestId: transId } }).catch(() => null);
    if (existing) return accepted;

    const amount = Math.round(Number(body.TransAmount || 0));
    const enough = amount >= booking.cashDue && booking.status === "awaiting_payment" && !booking.ledgerEntry;
    const receipt = transId; // C2B confirmations carry the real M-Pesa receipt

    await db.mpesaTransaction.create({
      data: {
        bookingId: booking.id,
        phone: body.MSISDN || "paybill",
        amount: amount || booking.cashDue,
        checkoutRequestId: transId,
        merchantRequestId: `c2b-${body.TransTime || Date.now()}`,
        status: enough ? "confirmed" : "failed",
        resultCode: enough ? RESULT_CODES.SUCCESS : "4001",
        resultDesc: enough
          ? "C2B confirmation — paybill payment matched to booking"
          : `C2B received KSh ${amount} but ${booking.status === "awaiting_payment" ? `booking needs KSh ${booking.cashDue}` : `booking is ${booking.status}`}`,
        mpesaReceipt: receipt,
        confirmedAt: enough ? new Date() : null,
      },
    });

    if (enough) {
      await confirmBookingPayment(booking.id, {
        receipt: receipt || generateMpesaReceipt(),
        checkoutRequestId: transId,
      });
      await audit({
        actorId: "system",
        actorName: "Daraja C2B",
        actorRole: "system",
        action: "payment.c2b_confirmed",
        entity: "booking",
        entityId: booking.id,
        metadata: { code: booking.code, receipt, amount },
      });
    } else {
      await audit({
        actorId: "system",
        actorName: "Daraja C2B",
        actorRole: "system",
        action: "payment.c2b_mismatch",
        entity: "booking",
        entityId: booking.id,
        metadata: { code: booking.code, receipt, amount, bookingStatus: booking.status },
      });
    }
  } catch {
    // Never 500.
  }
  return accepted;
}
