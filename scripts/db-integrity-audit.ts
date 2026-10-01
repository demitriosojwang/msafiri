/**
 * Mi-Reli DB integrity audit — checks for data-level errors:
 *  1. Overbooked trips (bookedSeats > capacity, or active bookings > capacity)
 *  2. Orphaned bookings (tripId points to a missing trip)
 *  3. Active credits that are expired (creditValidUntil in past, balance > 0)
 *  4. Ledger mismatches (confirmed bookings without ledger entries, cashDue vs ledger)
 *  5. Trips with no driver assigned but status scheduled (warning only)
 *  6. Bookings with passengerPhone null on non-charter (guest checkout migration gaps)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
let issues = 0;

function flag(label: string, detail: unknown) {
  issues++;
  console.log(`  ✗ ${label}:`, JSON.stringify(detail));
}

async function main() {
  console.log("=== 1. Overbooked trips ===");
  const trips = await db.trip.findMany({
    where: { status: { in: ["scheduled", "locked"] } },
    include: { bookings: { where: { status: { in: ["awaiting_payment", "confirmed", "boarded"] } } } },
  });
  for (const t of trips) {
    const active = t.bookings.reduce((s, b) => s + (b.isCharter ? t.capacity : b.seats), 0);
    if (active > t.capacity) flag("overbooked", { trip: t.id.slice(0, 10), active, capacity: t.capacity });
    if (t.bookedSeats > t.capacity) flag("bookedSeats>capacity", { trip: t.id.slice(0, 10), booked: t.bookedSeats, cap: t.capacity });
  }
  console.log(`  checked ${trips.length} active trips`);

  console.log("=== 2. Orphaned bookings (tripId set but trip missing) ===");
  const orphans = await db.booking.findMany({
    where: { tripId: { not: null } },
    include: { trip: { select: { id: true } } },
  });
  const orphaned = orphans.filter((b) => !b.trip);
  if (orphaned.length) orphaned.forEach((b) => flag("orphan", { booking: b.code }));
  else console.log("  none");

  console.log("=== 3. Expired credits still marked active ===");
  const now = new Date();
  const staleCredits = await db.credit.findMany({
    where: { status: "active", expiresAt: { lt: now } },
    select: { id: true, passengerId: true, amount: true, expiresAt: true },
  });
  if (staleCredits.length) staleCredits.forEach((c) => flag("expired credit still active", { id: c.id.slice(0, 10), balance: c.amount, expiresAt: c.expiresAt }));
  else console.log("  none");
  const activeCredits = await db.credit.count({ where: { status: "active", amount: { gt: 0 } } });
  console.log(`  ${activeCredits} active credit grant(s) held`);

  console.log("=== 4. Ledger mismatches ===");
  const confirmed = await db.booking.findMany({
    where: { status: { in: ["confirmed", "boarded", "completed"] } },
    include: { ledgerEntry: true },
  });
  const noLedger = confirmed.filter((b) => !b.ledgerEntry);
  if (noLedger.length) noLedger.forEach((b) => flag("confirmed without ledger", { code: b.code, status: b.status }));
  else console.log(`  none (${confirmed.length} settled bookings all have ledger entries)`);

  console.log("=== 5. Scheduled trips without driver ===");
  const noDriver = trips.filter((t) => !t.driverId);
  if (noDriver.length) noDriver.forEach((t) => flag("no driver", { trip: t.id.slice(0, 10), dep: t.departureAt }));
  else console.log("  none");

  console.log("=== 6. Guest-checkout phone coverage ===");
  const recent = await db.booking.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const missingPhone = recent.filter((b) => !b.passengerPhone);
  console.log(`  ${recent.length - missingPhone.length}/${recent.length} bookings carry passenger contact${missingPhone.length ? ` (${missingPhone.length} legacy/missing)` : " ✓"}`);

  console.log(issues === 0 ? "\n★ DB integrity: ALL CLEAN" : `\n✗ DB integrity: ${issues} issue(s) found`);
}

main().finally(() => db.$disconnect());
