import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPassengerSession } from "@/lib/session";

export async function GET() {
  const session = await getPassengerSession();
  if (!session) return NextResponse.json({ session: null });
  const passenger = await db.passenger.findUnique({ where: { id: session.id } });
  if (!passenger) return NextResponse.json({ session: null });
  const credits = await db.credit.findMany({
    where: { passengerId: passenger.id, status: "active", expiresAt: { gt: new Date() } },
  });
  const creditBalance = credits.reduce((s, c) => s + c.amount, 0);
  return NextResponse.json({
    session,
    passenger: { id: passenger.id, name: passenger.name, phone: passenger.phone },
    creditBalance,
    activeCredits: credits.length,
  });
}
