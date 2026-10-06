import {db} from "@/lib/db";
import {requireReviewer} from "@/lib/driver/review";
import {reviewPayoutDestination} from "@/lib/driver/beneficiary";
import {DriverError} from "@/lib/driver/errors";
import {readBoundedBody} from "@/lib/http-body";
export const runtime="nodejs";
async function handler(req:Request){try{
  const actor=await requireReviewer(req,"finance");
  const result=req.method==="GET"?{destinations:await db.driverPayoutDestination.findMany({orderBy:{updatedAt:"desc"},take:100,include:{driver:{select:{name:true,phone:true,status:true}}}})}:await reviewPayoutDestination(JSON.parse((await readBoundedBody(req,16384)).toString()),actor);
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
}catch(e){return Response.json({error:e instanceof DriverError?e.message:"Beneficiary review unavailable."},{status:e instanceof DriverError?e.status:503,headers:{"Cache-Control":"no-store"}});}}
export const GET=handler;export const POST=handler;
