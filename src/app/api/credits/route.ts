import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPassengerSession } from "@/lib/session";
import { runOperationalTick } from "@/lib/engine";

/** My travel credits — vouchers issued on late cancellation; never cash. */
export async function GET() {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await runOperationalTick();
  const credits = await db.credit.findMany({
    where: { passengerId: session.id },
    orderBy: { issuedAt: "desc" },
  });
  const now = new Date();
  const active = credits.filter((c) => c.status === "active" && c.expiresAt > now);
  return NextResponse.json({
    balance: active.reduce((s, c) => s + c.amount, 0),
    credits: credits.map((c) => ({
      id: c.id,
      amount: c.amount,
      initialAmount: c.initialAmount,
      status: c.status === "active" && c.expiresAt <= now ? "expired" : c.status,
      note: c.note,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      redeemedBookingId: c.redeemedBookingId,
    })),
  });
}
