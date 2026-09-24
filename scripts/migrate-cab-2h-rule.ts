/**
 * One-off migration: apply the uniform "cabs leave stages exactly 2h before
 * their train departs MTM" rule to every future TO_TERMINUS trip that was
 * scheduled under the old staggered (route-duration-based) times.
 */
import { PrismaClient } from "@prisma/client";

const CAB_LEAD_MINUTES = 120;

const prisma = new PrismaClient();

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return { h: h || 0, m: m || 0 };
}

async function main() {
  const trains = await prisma.train.findMany();
  const byId = new Map(trains.map((t) => [t.id, t]));

  const trips = await prisma.trip.findMany({
    where: { direction: "TO_TERMINUS", status: { in: ["scheduled", "locked"] }, trainId: { not: null } },
    include: { train: true },
  });

  const now = Date.now();
  let moved = 0;
  for (const t of trips) {
    if (!t.train) continue;
    const { h, m } = parseHHMM(t.train.originTime);
    const trainDep = new Date(t.departureAt);
    trainDep.setHours(h, m, 0, 0);
    const dep = new Date(trainDep.getTime() - CAB_LEAD_MINUTES * 60 * 1000);
    if (dep.getTime() !== t.departureAt.getTime() && dep.getTime() > now) {
      await prisma.trip.update({ where: { id: t.id }, data: { departureAt: dep } });
      moved++;
      console.log(`moved ${t.id.slice(-6)} ${t.train.name}: ${t.departureAt.toISOString().slice(11, 16)} → ${dep.toISOString().slice(11, 16)} (train ${t.train.originTime})`);
    }
  }
  console.log(`Done — ${moved} trip(s) rescheduled to the 2h rule.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
