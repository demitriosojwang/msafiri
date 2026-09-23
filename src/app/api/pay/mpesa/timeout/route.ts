import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * Safaricom Daraja → STK Push queue-timeout webhook (QueueTimeOutURL).
 *
 * Means the customer never acted on the prompt (or Safaricom lost it). We
 * mark the transaction ambiguous so the nightly Transaction Status sweep
 * makes the final call — never assume failure here, money may still have
 * moved (e.g. the customer answered just after the timeout).
 */
export async function POST(req: NextRequest) {
  const accepted = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      Body?: { stkCallback?: { CheckoutRequestID?: string } };
      CheckoutRequestID?: string;
    };
    const checkoutRequestId = body.Body?.stkCallback?.CheckoutRequestID || body.CheckoutRequestID;
    if (!checkoutRequestId) return accepted;

    const tx = await db.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
    if (tx && tx.status === "stk_push_sent") {
      await db.mpesaTransaction.update({
        where: { id: tx.id },
        data: { status: "ambiguous", resultDesc: "Queue timeout — awaiting Transaction Status sweep" },
      });
      await audit({
        actorId: "system",
        actorName: "Daraja Webhook",
        actorRole: "system",
        action: "payment.webhook_timeout",
        entity: "mpesa_transaction",
        entityId: tx.id,
        metadata: { checkoutRequestId, amount: tx.amount },
      });
    }
  } catch {
    // Never 500.
  }
  return accepted;
}
