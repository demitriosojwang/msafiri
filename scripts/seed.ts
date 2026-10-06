/**
 * Mi-Reli seed — Mombasa SGR feeder network.
 *
 * Creates: config, the Madaraka Express timetable (MTM/NTM times), the North
 * & South Coast stage networks with their fares, drivers, and a small
 * historical money story so every ledger bucket is represented:
 *   held / driver_payable / commission_taken / refunded /
 *   converted_to_credit / forfeited — plus completed, failed and queued payouts.
 *
 * Forward trips are NOT seeded — `ensureTrips()` generates them train-synced
 * on first request.
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
  throw new Error("Legacy destructive seed is disabled. Use npm run preview:local for an isolated synthetic database.");
}

// Preserved for migration review only. Never invoked by the application or build.
async function legacySeedReference() {
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
  await db.train.deleteMany();
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

  // ── Madaraka Express timetable (MTM/NTM per official schedule) ────────────
  // From Nairobi to Mombasa — arrivals at MTM
  //   Inter-County NTM 08:00 → MTM 14:00 · Express NTM 15:00 → MTM 20:30
  //   Night Train NTM 22:00 → MTM 03:55 (+1 day)
  // From Mombasa to Nairobi — departures from MTM
  //   Inter-County MTM 08:00 → NTM 14:10 · Express MTM 15:00 → NTM 20:18
  //   Night Train MTM 22:00 → NTM 03:55 (+1 day)
  const trains = await Promise.all(
    [
      { name: "Inter-County", direction: "MBA_TO_NBO", originCode: "MTM", destCode: "NTM", originTime: "08:00", destTime: "14:10", destDayOffset: 0 },
      { name: "Express", direction: "MBA_TO_NBO", originCode: "MTM", destCode: "NTM", originTime: "15:00", destTime: "20:18", destDayOffset: 0 },
      { name: "Night Train", direction: "MBA_TO_NBO", originCode: "MTM", destCode: "NTM", originTime: "22:00", destTime: "03:55", destDayOffset: 1 },
      { name: "Inter-County", direction: "NBO_TO_MBA", originCode: "NTM", destCode: "MTM", originTime: "08:00", destTime: "14:00", destDayOffset: 0 },
      { name: "Express", direction: "NBO_TO_MBA", originCode: "NTM", destCode: "MTM", originTime: "15:00", destTime: "20:30", destDayOffset: 0 },
      { name: "Night Train", direction: "NBO_TO_MBA", originCode: "NTM", destCode: "MTM", originTime: "22:00", destTime: "03:55", destDayOffset: 1 },
    ].map((t) => db.train.create({ data: t }))
  );
  const meetTrain = (name: string, direction: string) =>
    trains.find((t) => t.name === name && t.direction === direction)!;

  // ── Routes & stages (station prices as supplied) ───────────────────────────
  const route1 = await db.route.create({
    data: {
      name: "Mombasa Terminus ↔ North Coast (Mtwapa · Malindi)",
      durationMinutes: 90,
      charterPrice: 3800,
      stages: {
        create: [
          { name: "Mombasa Terminus (MTM)", order: 0, lat: -4.0476, lng: 39.6451, fare: 0, homeSurcharge: 0 },
          { name: "Kiembeni Mwisho", order: 1, lat: -3.9652, lng: 39.7062, fare: 400, homeSurcharge: 60 },
          { name: "Kiembeni Police", order: 2, lat: -3.9668, lng: 39.7091, fare: 400, homeSurcharge: 60 },
          { name: "Ananda Marga", order: 3, lat: -3.9701, lng: 39.7124, fare: 400, homeSurcharge: 60 },
          { name: "San Sera", order: 4, lat: -3.9732, lng: 39.7153, fare: 400, homeSurcharge: 60 },
          { name: "Green Estate", order: 5, lat: -3.9756, lng: 39.7178, fare: 400, homeSurcharge: 60 },
          { name: "Kona Kiembeni", order: 6, lat: -3.9779, lng: 39.7201, fare: 400, homeSurcharge: 60 },
          { name: "Bamburi Mwisho", order: 7, lat: -3.9761, lng: 39.7353, fare: 400, homeSurcharge: 60 },
          { name: "Naivas Bamburi", order: 8, lat: -3.9868, lng: 39.7261, fare: 400, homeSurcharge: 60 },
          { name: "Total Bamburi", order: 9, lat: -3.9841, lng: 39.7292, fare: 400, homeSurcharge: 60 },
          { name: "Fisheries", order: 10, lat: -3.9462, lng: 39.7481, fare: 400, homeSurcharge: 60 },
          { name: "Mwembeni", order: 11, lat: -3.9438, lng: 39.7434, fare: 400, homeSurcharge: 60 },
          { name: "JCC Junction", order: 12, lat: -3.9689, lng: 39.7372, fare: 400, homeSurcharge: 60 },
          { name: "Nyali Center", order: 13, lat: -4.0421, lng: 39.7263, fare: 400, homeSurcharge: 60 },
          { name: "VOK", order: 14, lat: -4.0391, lng: 39.7183, fare: 400, homeSurcharge: 60 },
          { name: "Bombolulu", order: 15, lat: -4.0053, lng: 39.7081, fare: 400, homeSurcharge: 60 },
          { name: "Lights", order: 16, lat: -3.9992, lng: 39.7132, fare: 400, homeSurcharge: 60 },
          { name: "Mtwapa", order: 17, lat: -3.9483, lng: 39.7456, fare: 400, homeSurcharge: 60 },
          { name: "Malindi", order: 18, lat: -3.2219, lng: 40.1169, fare: 700, homeSurcharge: 150 },
        ],
      },
    },
  });

  const route2 = await db.route.create({
    data: {
      name: "Mombasa Terminus ↔ South Coast (Likoni · Diani)",
      durationMinutes: 120,
      charterPrice: 3200,
      stages: {
        create: [
          { name: "Mombasa Terminus (MTM)", order: 0, lat: -4.0476, lng: 39.6451, fare: 0, homeSurcharge: 0 },
          { name: "Likoni Ferry Container", order: 1, lat: -4.0661, lng: 39.6682, fare: 400, homeSurcharge: 60 },
          { name: "Kona Mpya (Fayaz)", order: 2, lat: -4.0883, lng: 39.6032, fare: 400, homeSurcharge: 60 },
          { name: "ShikaAdabu Checkpoint", order: 3, lat: -4.1121, lng: 39.5923, fare: 400, homeSurcharge: 60 },
          { name: "Diani Naivas", order: 4, lat: -4.2802, lng: 39.5918, fare: 500, homeSurcharge: 100 },
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

  // ── Historical money story (yesterday) ────────────────────────────────────
  // Forward schedule is generated train-synced by ensureTrips() on demand.
  // Yesterday's two completed trips below are anchored to real train arrivals:
  //   H1 meets the Inter-County arriving MTM 14:00 (shuttle left 14:45)
  //   H2 meets the Express arriving MTM 20:30 (shuttle left 21:15)
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
  const yesterdayDep = at(now, -1, 14); // 14:45 shuttle meeting the 14:00 Inter-County arrival
  yesterdayDep.setMinutes(45);
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
      completedAt: new Date(yesterdayDep.getTime() + 90 * 60 * 1000),
      source: "schedule",
      trainId: meetTrain("Inter-County", "NBO_TO_MBA").id,
    },
  });

  const h1Bookings = [
    { key: "+254701111111", stageIdx: 3, seats: 2, boarded: true, outcome: "completed", payoutStatus: "completed" as const }, // Ananda Marga ×2
    { key: "+254701111112", stageIdx: 18, seats: 1, boarded: true, outcome: "completed", payoutStatus: "completed" as const }, // Malindi
    { key: "+254701111117", stageIdx: 1, seats: 1, boarded: false, outcome: "refunded", payoutStatus: null }, // Kiembeni Mwisho
    { key: "+254701111113", stageIdx: 4, seats: 1, boarded: false, outcome: "converted_to_credit", payoutStatus: null }, // San Sera
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

  // Trip H2 — Daniel's route: failed payout + forfeited no-show + queued payout
  const yesterdayDep2 = at(now, -1, 21); // 21:15 shuttle meeting the 20:30 Express arrival
  yesterdayDep2.setMinutes(15);
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
      completedAt: new Date(yesterdayDep2.getTime() + 120 * 60 * 1000),
      source: "schedule",
      trainId: meetTrain("Express", "NBO_TO_MBA").id,
    },
  });
  const h2Plan = [
    { key: "+254701111114", seats: 3, stageIdx: 4, boarded: true, payout: "failed" as const, outcome: "completed" }, // Diani Naivas ×3
    { key: "+254701111115", seats: 1, stageIdx: 3, boarded: false, payout: null, outcome: "forfeited" }, // ShikaAdabu
    { key: "+254701111116", seats: 1, stageIdx: 1, boarded: true, payout: "queued" as const, outcome: "completed" }, // Likoni Ferry Container
  ];
  for (const [i, sb] of h2Plan.entries()) {
    const passengerId = passengers[sb.key];
    const stage = stages2[sb.stageIdx];
    const fare = stage.fare * sb.seats;
    const code = `MR-H2${i}${receipt().slice(0, 3)}`;
    const outcome = sb.payout === "failed" ? "completed" : (sb.outcome as string);
    // Ledger: money only reaches "commission_taken" once the B2C succeeded —
    // failed and queued payouts leave the fare at "driver_payable".
    const ledgerStatus =
      outcome === "completed"
        ? sb.payout === "queued" || sb.payout === "failed"
          ? "driver_payable"
          : "commission_taken"
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
