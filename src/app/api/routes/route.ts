import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runOperationalTick } from "@/lib/engine";

/** Network map for the booking form: routes with ordered stages + fares. */
export async function GET() {
  await runOperationalTick();
  const routes = await db.route.findMany({
    where: { active: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({
    routes: routes.map((r) => ({
      id: r.id,
      name: r.name,
      durationMinutes: r.durationMinutes,
      charterPrice: r.charterPrice,
      stages: r.stages.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        fare: s.fare,
        homeSurcharge: s.homeSurcharge,
      })),
    })),
  });
}
