import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import * as daraja from "@/lib/daraja";

/** Refund records — every refund needs a terminal state and a timestamp. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refunds = await db.refundRecord.findMany({
    orderBy: { initiatedAt: "desc" },
    take: 200,
    include: {
      booking: { include: { passenger: true } },
      ledgerEntry: true,
    },
  });

  return NextResponse.json({
    refunds: refunds.map((r) => ({
      id: r.id,
      code: r.booking.code,
      passenger: r.booking.passenger.name,
      amount: r.amount,
      creditRestored: r.creditRestored,
      commissionReversed: r.commissionReversed,
      driverClawback: r.driverClawback,
      reason: r.reason,
      method: r.method,
      status: r.status,
      stuck: r.stuckFlaggedAt !== null,
      result: r.mpesaResultCode,
      failureReason: r.failureReason,
      initiatedAt: r.initiatedAt,
      completedAt: r.completedAt,
      ledgerStatus: r.ledgerEntry.status,
    })),
  });
}

/** Retry a failed refund — one deliberate attempt, never a silent loop. */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const refund = await db.refundRecord.findUnique({
    where: { id: body.id },
    include: { booking: { include: { passenger: true } }, ledgerEntry: true },
  });
  if (!refund) return NextResponse.json({ error: "Refund not found" }, { status: 404 });
  if (refund.status === "completed") return NextResponse.json({ error: "Refund already completed" }, { status: 400 });

  const result =
    refund.method === "reversal"
      ? await daraja.reversal({ transactionId: refund.ledgerEntry.mpesaReceipt || refund.booking.code, amount: refund.amount })
      : await daraja.b2c({ receiverPhone: refund.booking.passenger.phone, amount: refund.amount, remarks: `Refund ${refund.booking.code}` });
  const ok = result.resultCode === daraja.RESULT_CODES.SUCCESS;
  await db.refundRecord.update({
    where: { id: refund.id },
    data: {
      status: ok ? "completed" : "failed",
      mpesaResultCode: result.resultCode,
      failureReason: ok ? null : result.resultDesc,
      stuckFlaggedAt: null,
      completedAt: ok ? new Date() : null,
    },
  });
  if (ok) {
    await db.ledgerEntry.update({
      where: { id: refund.ledgerEntryId },
      data: { status: "refunded", statusChangedAt: new Date() },
    });
  }
  await audit({
    actorId: session.id,
    actorName: session.name,
    actorRole: "admin",
    action: "money.refund_retry",
    entity: "refund",
    entityId: refund.id,
    metadata: { ok, result: result.resultDesc },
  });
  return NextResponse.json({ ok, result: result.resultDesc });
}
