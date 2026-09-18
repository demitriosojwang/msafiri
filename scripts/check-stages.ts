import { db } from "../src/lib/db";
const stages = await db.routeStage.findMany({ where: { order: { gt: 0 } }, select: { name: true, fare: true, homeSurcharge: true }, take: 6 });
console.log(JSON.stringify(stages));
await db.$disconnect();
