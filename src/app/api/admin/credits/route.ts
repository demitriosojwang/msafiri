import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { runOperationalTick } from "@/lib/engine";

/** Credits — outstanding platform liability, never cashed out. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await runOperationalTick();

  const credits = await db.credit.findMany({
    orderBy: { issuedAt: "desc" },
    take: 200,
    include: { passenger: true },
  });
  const now = new Date();
  const active = credits.filter((c) => c.status === "active" && c.expiresAt > now);

  return NextResponse.json({
    liability: active.reduce((s, c) => s + c.amount, 0),
    counts: {
      active: active.length,
      redeemed: credits.filter((c) => c.status === "redeemed").length,
      expired: credits.filter((c) => c.status === "expired" || (c.status === "active" && c.expiresAt <= now)).length,
    },
    credits: credits.map((c) => ({
      id: c.id,
      passenger: c.passenger.name,
      phone: c.passenger.phone,
      amount: c.amount,
      initialAmount: c.initialAmount,
      status: c.status === "active" && c.expiresAt <= now ? "expired" : c.status,
      note: c.note,
      sourceBookingId: c.sourceBookingId,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      redeemedBookingId: c.redeemedBookingId,
    })),
  });
}
