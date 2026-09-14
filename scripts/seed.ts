/**
 * Mi-Reli seed — Mombasa SGR feeder network.
 *
 * Creates: config, routes+stages, drivers, the trip schedule horizon,
 * and a small historical money story so every ledger bucket is represented:
 *   held / driver_payable / commission_taken / refunded /
 *   converted_to_credit / forfeited — plus completed, failed and queued payouts.
 *
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const H = 60 * 60 * 1000;
const D = 24 * H;

function at(base: Date, dayOffset: number, hour: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function receipt() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function main() {
  const now = new Date();
  console.log("Seeding Mi-Reli…");

  // wipe (FK-safe order)
  await db.auditLog.deleteMany();
  await db.mpesaTransaction.deleteMany();
  await db.refundRecord.deleteMany();
  await db.payoutRecord.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.credit.deleteMany();
  await db.booking.deleteMany();
  await db.trip.deleteMany();
  await db.routeStage.deleteMany();
  await db.route.deleteMany();
  await db.driver.deleteMany();
  await db.passenger.deleteMany();
  await db.platformConfig.deleteMany();

  // ── Config (credit validity = 30 days per product decision) ───────────────
  await db.platformConfig.create({
    data: {
      id: "main",
      commissionRate: 0.15,
      fullRefundCutoffMinutes: 60,
      seatFillThresholdPercent: 70,
      creditValidityDays: 30,
      payoutMode: "weekly",
      payoutDay: 5, // Friday
      stuckRefundHours: 4,
      stuckPayoutHours: 24,
      sweepPendingMinutes: 5,
      tripHorizonDays: 2,
      bookingWindowMinutes: 15,
      lastPayoutRunAt: new Date(now.getTime() - 3 * D),
    },
  });

  // ── Routes & stages ────────────────────────────────────────────────────────
  const route1 = await db.route.create({
    data: {
      name: "Miritini ↔ Likoni Ferry",
      durationMinutes: 75,
      charterPrice: 3200,
      stages: {
        create: [
          { name: "Miritini Terminus", order: 0, lat: -4.022, lng: 39.642, fare: 150, homeSurcharge: 40 },
          { name: "Kipevu Link", order: 1, lat: -4.032, lng: 39.638, fare: 210, homeSurcharge: 48 },
          { name: "Jomvu", order: 2, lat: -4.04, lng: 39.65, fare: 270, homeSurcharge: 56 },
          { name: "Magongo", order: 3, lat: -4.05, lng: 39.662, fare: 330, homeSurcharge: 64 },
          { name: "Port Reitz", order: 4, lat: -4.058, lng: 39.67, fare: 390, homeSurcharge: 72 },
          { name: "Likoni Ferry", order: 5, lat: -4.068, lng: 39.67, fare: 450, homeSurcharge: 80 },
        ],
      },
    },
  });

  const route2 = await db.route.create({
    data: {
      name: "Miritini ↔ Mombasa CBD",
      durationMinutes: 60,
      charterPrice: 3000,
      stages: {
        create: [
          { name: "Miritini Terminus", order: 0, lat: -4.022, lng: 39.642, fare: 120, homeSurcharge: 40 },
          { name: "Jomvu", order: 1, lat: -4.04, lng: 39.65, fare: 180, homeSurcharge: 48 },
          { name: "Changamwe", order: 2, lat: -4.045, lng: 39.632, fare: 240, homeSurcharge: 56 },
          { name: "Moi Airport", order: 3, lat: -4.034, lng: 39.594, fare: 300, homeSurcharge: 64 },
          { name: "Mombasa CBD (GPO)", order: 4, lat: -4.054, lng: 39.667, fare: 360, homeSurcharge: 72 },
        ],
      },
    },
  });

  const route3 = await db.route.create({
    data: {
      name: "Miritini ↔ Mtwapa",
      durationMinutes: 90,
      charterPrice: 4200,
      stages: {
        create: [
          { name: "Miritini Terminus", order: 0, lat: -4.022, lng: 39.642, fare: 180, homeSurcharge: 50 },
          { name: "Kisauni", order: 1, lat: -4.006, lng: 39.68, fare: 260, homeSurcharge: 58 },
          { name: "Bamburi", order: 2, lat: -3.996, lng: 39.7, fare: 340, homeSurcharge: 66 },
          { name: "Nyali", order: 3, lat: -4.0, lng: 39.72, fare: 420, homeSurcharge: 74 },
          { name: "Mtwapa", order: 4, lat: -3.95, lng: 39.745, fare: 520, homeSurcharge: 90 },
        ],
      },
    },
  });

  const stages1 = await db.routeStage.findMany({ where: { routeId: route1.id }, orderBy: { order: "asc" } });
  const stages2 = await db.routeStage.findMany({ where: { routeId: route2.id }, orderBy: { order: "asc" } });

  // ── Drivers (admin-managed; #6 carries the invalid-M-Pesa demo) ───────────
  const drivers = await Promise.all(
    [
      { name: "Mwangi Kariuki", phone: "+254722334455", mpesa: "+254722334455", plate: "KDA 471X", type: "14-seater matatu", cap: 13 },
      { name: "Amani Otieno", phone: "+254733445566", mpesa: "+254733445566", plate: "KDB 820M", type: "14-seater matatu", cap: 13 },
      { name: "Juma Hassan", phone: "+254712345001", mpesa: "+254712345001", plate: "KDC 314J", type: "Noah (7-seater)", cap: 7 },
      { name: "Patrick Mutua", phone: "+254712345002", mpesa: "+254712345002", plate: "KDA 905T", type: "Noah (7-seater)", cap: 7 },
      { name: "Fatuma Ali", phone: "+254712345003", mpesa: "+254712345003", plate: "KDF 662K", type: "14-seater matatu", cap: 13 },
      { name: "Daniel Mwakio", phone: "+254712345004", mpesa: "+254700000013", plate: "KDG 210L", type: "14-seater matatu", cap: 13 },
    ].map((d) =>
      db.driver.create({
        data: {
          name: d.name,
          phone: d.phone,
          mpesaNumber: d.mpesa,
          plate: d.plate,
          cabType: d.type,
          capacity: d.cap,
        },
      })
    )
  );

  // ── Trip schedule horizon ──────────────────────────────────────────────────
  const SCHEDULE_HOURS = [6, 9, 12, 15, 18, 20];
  const routes = [route1, route2, route3];
  let rr = 0;
  for (let dayOffset = -1; dayOffset <= 2; dayOffset++) {
    for (const route of routes) {
      for (const direction of ["FROM_TERMINUS", "TO_TERMINUS"]) {
        for (const h of SCHEDULE_HOURS) {
          const dep = at(now, dayOffset, h);
          if (dayOffset < 0 && dep.getTime() > now.getTime() - 6 * H) continue;
          if (dayOffset >= 0 && dep.getTime() < now.getTime() - 30 * 60 * 1000) continue;
          const driver = drivers[rr++ % drivers.length];
          await db.trip.create({
            data: {
              routeId: route.id,
              driverId: driver.id,
              direction,
              departureAt: dep,
              capacity: driver.capacity,
              status: dayOffset < 0 ? "completed" : "scheduled",
              source: "schedule",
            },
          });
        }
      }
    }
  }

  // ── Historical money story (yesterday) ────────────────────────────────────
  const passengersData = [
    { name: "Grace Wanjiku", phone: "+254701111111" },
    { name: "John Ochieng", phone: "+254701111112" },
    { name: "Neema Nzisa", phone: "+254701111113" },
    { name: "Brian Kimani", phone: "+254701111114" },
    { name: "Halima Yusuf", phone: "+254701111115" },
    { name: "Kevin Omondi", phone: "+254701111116" },
    { name: "Zawadi Mumo", phone: "+254701111117" },
  ];
  const passengers: Record<string, string> = {};
  for (const p of passengersData) {
    const rec = await db.passenger.create({ data: { name: p.name, phone: p.phone } });
    passengers[p.phone] = rec.id;
  }

  const commissionRate = 0.15;
  const yesterdayDep = at(now, -1, 9);
  const tripH1 = await db.trip.create({
    data: {
      routeId: route1.id,
      driverId: drivers[1].id, // Amani — healthy payouts
      direction: "FROM_TERMINUS",
      departureAt: yesterdayDep,
      capacity: drivers[1].capacity,
      bookedSeats: 5,
      status: "completed",
      lockedAt: new Date(yesterdayDep.getTime() - 2 * H),
      departedAt: yesterdayDep,
      completedAt: new Date(yesterdayDep.getTime() + 75 * 60 * 1000),
      source: "schedule",
    },
  });

  const h1Bookings = [
    { key: "+254701111111", stageIdx: 3, seats: 2, boarded: true, outcome: "completed", payoutStatus: "completed" as const },
    { key: "+254701111112", stageIdx: 5, seats: 1, boarded: true, outcome: "completed", payoutStatus: "completed" as const },
    { key: "+254701111117", stageIdx: 1, seats: 1, boarded: false, outcome: "refunded", payoutStatus: null },
    { key: "+254701111113", stageIdx: 4, seats: 1, boarded: false, outcome: "converted_to_credit", payoutStatus: null },
  ];

  for (const [i, sb] of h1Bookings.entries()) {
    const passengerId = passengers[sb.key];
    const stage = stages1[sb.stageIdx];
    const fare = stage.fare * sb.seats;
    const code = `MR-H1${i}${receipt().slice(0, 3)}`;
    const ledgerStatus =
      sb.outcome === "completed" && sb.payoutStatus === "completed"
        ? "commission_taken"
        : sb.outcome === "refunded"
          ? "refunded"
          : "converted_to_credit";
    const b = await db.booking.create({
      data: {
        code,
        passengerId,
        tripId: tripH1.id,
        routeId: route1.id,
        direction: "FROM_TERMINUS",
        stageId: stage.id,
        stageName: stage.name,
        seats: sb.seats,
        fareAmount: fare,
        homeSurcharge: 0,
        creditApplied: 0,
        cashDue: fare,
        status: sb.outcome === "refunded" ? "cancelled" : sb.outcome,
        cancelTier: sb.outcome === "refunded" ? "early" : sb.outcome === "converted_to_credit" ? "late" : null,
        checkedInAt: sb.boarded ? new Date(yesterdayDep.getTime() - 20 * 60 * 1000) : null,
        cancelledAt: sb.outcome === "refunded" ? new Date(yesterdayDep.getTime() - 3 * H) : null,
        createdAt: new Date(yesterdayDep.getTime() - 20 * H),
      },
    });
    const entry = await db.ledgerEntry.create({
      data: {
        bookingId: b.id,
        tripId: tripH1.id,
        totalAmount: fare,
        cashAmount: fare,
        creditApplied: 0,
        homeSurchargeAmount: 0,
        mpesaReceipt: receipt(),
        collectedAt: new Date(yesterdayDep.getTime() - 18 * H),
        status: ledgerStatus,
        statusChangedAt: new Date(yesterdayDep.getTime() + 2 * H),
        createdAt: new Date(yesterdayDep.getTime() - 18 * H),
      },
    });
    if (sb.outcome === "refunded") {
      await db.refundRecord.create({
        data: {
          ledgerEntryId: entry.id,
          bookingId: b.id,
          amount: fare,
          reason: "cancelled_early",
          method: "reversal",
          mpesaResultCode: "0",
          status: "completed",
          initiatedAt: new Date(yesterdayDep.getTime() - 3 * H),
          completedAt: new Date(yesterdayDep.getTime() - 3 * H + 12 * 60 * 1000),
        },
      });
    }
    if (sb.outcome === "converted_to_credit") {
      await db.credit.create({
        data: {
          passengerId,
          sourceBookingId: b.id,
          amount: fare,
          initialAmount: fare,
          status: "active",
          note: `Late cancellation of ${code} — fare saved as credit`,
          issuedAt: new Date(yesterdayDep.getTime() - 2 * H),
          expiresAt: new Date(Date.now() + 28 * D),
        },
      });
    }
    if (sb.outcome === "completed" && sb.payoutStatus) {
      const commission = Math.round(fare * commissionRate);
      await db.payoutRecord.create({
        data: {
          driverId: drivers[1].id,
          tripId: tripH1.id,
          grossFareTotal: fare,
          commissionAmount: commission,
          homeSurchargeAmount: 0,
          netPayoutAmount: fare - commission,
          method: "b2c",
          mpesaResultCode: sb.payoutStatus === "completed" ? "0" : null,
          status: sb.payoutStatus,
          batchId: sb.payoutStatus === "completed" ? "batch-seed-fri" : null,
          initiatedAt: new Date(yesterdayDep.getTime() + 2 * H),
          completedAt: sb.payoutStatus === "completed" ? new Date(yesterdayDep.getTime() + 3 * H) : null,
        },
      });
    }
  }

  // Trip H2 — Mwangi's route: failed payout + forfeited no-show + queued payout
  const yesterdayDep2 = at(now, -1, 15);
  const tripH2 = await db.trip.create({
    data: {
      routeId: route2.id,
      driverId: drivers[5].id, // Daniel Mwakio — invalid M-Pesa number demo
      direction: "FROM_TERMINUS",
      departureAt: yesterdayDep2,
      capacity: drivers[0].capacity,
      bookedSeats: 5,
      status: "completed",
      lockedAt: new Date(yesterdayDep2.getTime() - 2 * H),
      departedAt: yesterdayDep2,
      completedAt: new Date(yesterdayDep2.getTime() + 60 * 60 * 1000),
      source: "schedule",
    },
  });
  const h2Plan = [
    { key: "+254701111114", seats: 3, stageIdx: 4, boarded: true, payout: "failed" as const, outcome: "completed" },
    { key: "+254701111115", seats: 1, stageIdx: 3, boarded: false, payout: null, outcome: "forfeited" },
    { key: "+254701111116", seats: 1, stageIdx: 1, boarded: true, payout: "queued" as const, outcome: "completed" },
  ];
  for (const [i, sb] of h2Plan.entries()) {
    const passengerId = passengers[sb.key];
    const stage = stages2[sb.stageIdx];
    const fare = stage.fare * sb.seats;
    const code = `MR-H2${i}${receipt().slice(0, 3)}`;
    const outcome = sb.payout === "failed" ? "completed" : (sb.outcome as string);
    const ledgerStatus =
      outcome === "completed" && sb.payout === "completed"
        ? "commission_taken"
        : outcome === "completed"
          ? "driver_payable"
          : "forfeited";
    const b = await db.booking.create({
      data: {
        code,
        passengerId,
        tripId: tripH2.id,
        routeId: route2.id,
        direction: "FROM_TERMINUS",
        stageId: stage.id,
        stageName: stage.name,
        seats: sb.seats,
        fareAmount: fare,
        homeSurcharge: 0,
        creditApplied: 0,
        cashDue: fare,
        status: outcome,
        cancelTier: outcome === "forfeited" ? "no_show" : null,
        checkedInAt: sb.boarded ? new Date(yesterdayDep2.getTime() - 15 * 60 * 1000) : null,
        createdAt: new Date(yesterdayDep2.getTime() - 20 * H),
      },
    });
    const entry = await db.ledgerEntry.create({
      data: {
        bookingId: b.id,
        tripId: tripH2.id,
        totalAmount: fare,
        cashAmount: fare,
        creditApplied: 0,
        homeSurchargeAmount: 0,
        mpesaReceipt: receipt(),
        collectedAt: new Date(yesterdayDep2.getTime() - 18 * H),
        status: ledgerStatus,
        statusChangedAt: new Date(yesterdayDep2.getTime() + 2 * H),
        createdAt: new Date(yesterdayDep2.getTime() - 18 * H),
      },
    });
    if (sb.payout) {
      const commission = Math.round(fare * commissionRate);
      await db.payoutRecord.create({
        data: {
          driverId: drivers[5].id,
          tripId: tripH2.id,
          grossFareTotal: fare,
          commissionAmount: commission,
          homeSurchargeAmount: 0,
          netPayoutAmount: fare - commission,
          method: "b2c",
          mpesaResultCode: sb.payout === "failed" ? "1001" : null,
          status: sb.payout,
          failureReason: sb.payout === "failed" ? "B2C rejected: receiver +254700000013 is invalid or deregistered" : null,
          initiatedAt: new Date(yesterdayDep2.getTime() + 2 * H),
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log(`  routes=${await db.route.count()} stages=${await db.routeStage.count()} drivers=${await db.driver.count()}`);
  console.log(`  trips=${await db.trip.count()} bookings=${await db.booking.count()} ledger=${await db.ledgerEntry.count()}`);
  console.log(`  payouts=${await db.payoutRecord.count()} credits=${await db.credit.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
