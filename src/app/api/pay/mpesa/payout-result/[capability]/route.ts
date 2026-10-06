import {settleCallback} from "@/lib/payout-settlement";
import {DriverError} from "@/lib/driver/errors";
import {readBoundedBody} from "@/lib/http-body";
export async function POST(req:Request,{params}:{params:Promise<{capability:string}>}) {
  try {
    const parsed=JSON.parse((await readBoundedBody(req,16384)).toString("utf8"));
    await settleCallback((await params).capability,parsed.Result||{},new URL(req.url).searchParams.get("timeout")==="1");
    return Response.json({ResultCode:0,ResultDesc:"Accepted"});
  }catch(error){return Response.json({error:error instanceof DriverError?error.code:"CALLBACK_UNAVAILABLE"},{status:error instanceof DriverError?error.status:503});}
}
