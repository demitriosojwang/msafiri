/**
 * One-off repair: recompute bookedSeats from ACTIVE bookings for every
 * scheduled/locked trip. Fixes historical drift caused by the pre-fix bug
 * where cancellations never released seats (bookedSeats was inflated).
 * Also catches under-counting (bookedSeats < sum of active seats).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const trips = await db.trip.findMany({
    where: { status: { in: ["scheduled", "locked"] } },
    include: {
      bookings: { where: { status: { in: ["awaiting_payment", "confirmed", "boarded"] } } },
    },
  });
  let fixed = 0;
  for (const t of trips) {
    // A charter holds the entire cab; multiple actives shouldn't happen but take max
    const activeSeats = t.bookings.reduce((s, b) => s + (b.isCharter ? t.capacity : b.seats), 0);
    const truth = Math.min(activeSeats, t.capacity);
    if (t.bookedSeats !== truth) {
      await db.trip.update({ where: { id: t.id }, data: { bookedSeats: truth } });
      console.log(`fixed ${t.id.slice(0, 10)}: bookedSeats ${t.bookedSeats} -> ${truth} (${t.bookings.length} active bookings)`);
      fixed++;
    }
  }
  console.log(fixed === 0 ? "★ all trips already consistent" : `✓ repaired ${fixed} trip(s)`);
}

main().finally(() => db.$disconnect());
