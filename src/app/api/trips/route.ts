import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runOperationalTick } from "@/lib/engine";

/** Bookable departures for a date + direction. */
export async function GET(req: NextRequest) {
  await runOperationalTick();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const direction = searchParams.get("direction") || "FROM_TERMINUS";
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const now = new Date();

  const trips = await db.trip.findMany({
    where: {
      direction,
      departureAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["scheduled", "locked", "departed"] },
    },
    orderBy: { departureAt: "asc" },
    include: {
      route: { include: { stages: { orderBy: { order: "asc" } } } },
      driver: true,
      train: true,
      bookings: { where: { status: { in: ["awaiting_payment", "confirmed", "boarded", "completed"] } }, select: { seats: true } },
    },
  });

  return NextResponse.json({
    trips: trips.map((t) => {
      const relevantBooked = t.bookings.reduce((s, b) => s + b.seats, 0);
      const seatsLeft = Math.max(t.capacity - relevantBooked, 0);
      const stages = t.route.stages.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        fare: s.fare,
        homeSurcharge: s.homeSurcharge,
      }));
      const nonTerminusStages = stages.filter((s) => s.order > 0);
      const isFromTerminus = t.direction === "FROM_TERMINUS";
      const train = t.train
        ? {
            name: t.train.name,
            // MTM event time: the departure we race for, or the arrival we meet
            mtmTime: t.train.direction === "MBA_TO_NBO" ? t.train.originTime : t.train.destTime,
            ntmTime: t.train.direction === "MBA_TO_NBO" ? t.train.destTime : t.train.originTime,
            eventKind: t.train.direction === "MBA_TO_NBO" ? "departs_mtm" : "arrives_mtm",
          }
        : null;
      return {
        id: t.id,
        routeId: t.route.id,
        routeName: t.route.name,
        durationMinutes: t.route.durationMinutes,
        charterPrice: t.route.charterPrice,
        direction: t.direction,
        departureAt: t.departureAt,
        // TO_TERMINUS: when the cab reaches the terminus (before the train leaves).
        // FROM_TERMINUS: departureAt itself is the terminus departure.
        terminusAt: isFromTerminus
          ? t.departureAt
          : new Date(t.departureAt.getTime() + t.route.durationMinutes * 60 * 1000),
        train,
        status: t.status,
        capacity: t.capacity,
        seatsLeft,
        bookable: ["scheduled", "locked"].includes(t.status) && seatsLeft > 0 && t.departureAt > now,
        lockNote: t.status === "locked" ? "Bookings locked — late cancellation converts fare to credit" : null,
        driver: t.driver ? { name: t.driver.name, plate: t.driver.plate, cabType: t.driver.cabType, rating: t.driver.rating } : null,
        stages,
        // FROM_TERMINUS exposes drop-off points; TO_TERMINUS exposes pickup points
        pointsLabel: isFromTerminus ? "drop-off" : "pickup",
        points: nonTerminusStages,
        minFare: Math.min(...nonTerminusStages.map((s) => s.fare)),
      };
    }),
  });
}
