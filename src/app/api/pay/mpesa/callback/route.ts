import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmBookingPayment } from "@/lib/money";
import { RESULT_CODES } from "@/lib/daraja";

/**
 * Safaricom Daraja → STK Push result webhook (CallBackURL).
 *
 * Public by necessity — Daraja's servers call it. It is idempotent: the
 * CheckoutRequestID identifies the transaction, terminal states are never
 * overwritten, and the customer-facing confirmation also happens through the
 * verify button / nightly sweep, so a lost or duplicated webhook is harmless.
 *
 * Daraja requires a 200 with ResultCode 0 — anything else makes it retry.
 */

interface StkCallbackItem {
  Name: string;
  Value?: string | number;
}

interface StkCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: StkCallbackItem[] };
    };
  };
}

function meta(items: StkCallbackItem[] | undefined, name: string): string | undefined {
  const hit = items?.find((i) => i.Name === name);
  return hit?.Value !== undefined ? String(hit.Value) : undefined;
}

export async function POST(req: NextRequest) {
  const accepted = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  try {
    const body = (await req.json().catch(() => ({}))) as StkCallbackBody;
    const cb = body.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return accepted;

    const tx = await db.mpesaTransaction.findUnique({ where: { checkoutRequestId: cb.CheckoutRequestID } });
    if (!tx || ["confirmed", "failed"].includes(tx.status)) return accepted; // already terminal

    const code = String(cb.ResultCode ?? "");
    if (code === RESULT_CODES.SUCCESS) {
      const receipt = meta(cb.CallbackMetadata?.Item, "MpesaReceiptNumber");
      await db.mpesaTransaction.update({
        where: { id: tx.id },
        data: {
          status: "confirmed",
          resultCode: code,
          resultDesc: cb.ResultDesc || "The service request is processed successfully.",
          mpesaReceipt: receipt || tx.mpesaReceipt,
          confirmedAt: new Date(),
        },
      });
      await confirmBookingPayment(tx.bookingId, {
        receipt: receipt || tx.mpesaReceipt || tx.checkoutRequestId,
        checkoutRequestId: tx.checkoutRequestId,
      });
      await audit({
        actorId: "system",
        actorName: "Daraja Webhook",
        actorRole: "system",
        action: "payment.webhook_confirmed",
        entity: "mpesa_transaction",
        entityId: tx.id,
        metadata: { checkoutRequestId: tx.checkoutRequestId, receipt, amount: tx.amount },
      });
    } else {
      await db.mpesaTransaction.update({
        where: { id: tx.id },
        data: {
          status: "failed",
          resultCode: code,
          resultDesc: cb.ResultDesc || "Payment not completed",
        },
      });
      await audit({
        actorId: "system",
        actorName: "Daraja Webhook",
        actorRole: "system",
        action: "payment.webhook_failed",
        entity: "mpesa_transaction",
        entityId: tx.id,
        metadata: { checkoutRequestId: tx.checkoutRequestId, resultCode: code, desc: cb.ResultDesc },
      });
    }
  } catch {
    // Never 500 — Daraja retries on failure and we don't want duplicate storms.
  }
  return accepted;
}
