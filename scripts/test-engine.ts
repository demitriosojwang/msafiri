/**
 * Engine verification: builds a departed trip in the past with
 *  - one boarded (checked-in) paid passenger  → completed + payout record
 *  - one confirmed-but-never-checked-in pax   → no_show forfeit
 * then the ops tick (fired via the admin API) completes the trip.
 * Run: bun scripts/test-engine.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const H = 3600000;

async function main() {
  const now = new Date();
  const route = await db.route.findFirst({ where: { name: { contains: "Likoni" } }, include: { stages: { orderBy: { order: "asc" } } } });
  const driver = await db.driver.findFirst({ where: { name: "Amani Otieno" } });
  const p1 = await db.passenger.create({ data: { name: "Engine Test A", phone: "+254709000001" } });
  const p2 = await db.passenger.create({ data: { name: "Engine Test B", phone: "+254709000002" } });

  const departedAt = new Date(now.getTime() - 2 * H); // departed 2h ago; duration 75min → completable
  const trip = await db.trip.create({
    data: {
      routeId: route!.id,
      driverId: driver!.id,
      direction: "FROM_TERMINUS",
      departureAt: departedAt,
      capacity: driver!.capacity,
      bookedSeats: 2,
      status: "departed",
      lockedAt: new Date(departedAt.getTime() - H),
      departedAt,
      source: "schedule",
    },
  });

  const mk = async (paxId: string, code: string, fare: number, boarded: boolean) => {
    const b = await db.booking.create({
      data: {
        code,
        passengerId: paxId,
        tripId: trip.id,
        routeId: route!.id,
        direction: "FROM_TERMINUS",
        stageId: route!.stages[3].id,
        stageName: route!.stages[3].name,
        seats: 1,
        fareAmount: fare,
        homeSurcharge: 0,
        creditApplied: 0,
        cashDue: fare,
        status: boarded ? "boarded" : "confirmed",
        checkedInAt: boarded ? new Date(departedAt.getTime() - 15 * 60000) : null,
      },
    });
    await db.ledgerEntry.create({
      data: {
        bookingId: b.id,
        tripId: trip.id,
        totalAmount: fare,
        cashAmount: fare,
        creditApplied: 0,
        homeSurchargeAmount: 0,
        mpesaReceipt: "ENGTEST" + Math.floor(Math.random() * 1000),
        collectedAt: new Date(departedAt.getTime() - H),
        status: "held",
      },
    });
    return b;
  };

  await mk(p1.id, "MR-ENG01", 450, true); // boarded
  await mk(p2.id, "MR-ENG02", 330, false); // no-show candidate

  console.log("Test trip created:", trip.id, "departed", departedAt.toISOString());
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
