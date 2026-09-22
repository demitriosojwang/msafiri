import { db } from "../src/lib/db";
const trains = await db.train.findMany({ orderBy: [{ direction: "asc" }, { originTime: "asc" }] });
console.log(JSON.stringify(trains.map(t => ({ name: t.name, dir: t.direction, from: t.originCode, dep: t.originTime, arr: t.destTime, offset: t.destDayOffset })), null, 1));
await db.$disconnect();
