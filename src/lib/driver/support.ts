import {db} from "@/lib/db";
import {DriverError,text} from "./errors";
export async function supportCases(driverId:string) {
  return {cases:await db.driverSupportCase.findMany({where:{driverId},orderBy:{createdAt:"desc"},take:50,select:{id:true,category:true,message:true,status:true,reply:true,createdAt:true,updatedAt:true}})};
}
export async function createSupportCase(driverId:string,body:Record<string,unknown>) {
  const clientActionId=text(body.clientActionId,"Request ID",10,100),category=text(body.category,"Category",3,20),message=text(body.message,"Message",10,2000);
  if(!["account","documents","payout","trip","safety"].includes(category))throw new DriverError(400,"INVALID_CATEGORY","Support category is invalid.");
  const row=await db.driverSupportCase.upsert({where:{driverId_clientActionId:{driverId,clientActionId}},update:{},create:{driverId,clientActionId,category,message}});
  if(row.category!==category || row.message!==message)throw new DriverError(409,"ACTION_CONFLICT","This request ID was used for a different message.");
  return supportCases(driverId);
}
