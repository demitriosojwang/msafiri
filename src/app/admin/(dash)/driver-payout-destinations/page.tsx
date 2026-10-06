"use client";
import {useState} from "react";
import {useAdminData} from "@/components/admin/use-admin-data";
import {api} from "@/lib/client";
import {Button} from "@/components/ui/button";
type Destination={id:string;version:number;status:string;phone:string;accountName:string;reviewNote:string|null;driver:{name:string;status:string}};
function Review({row,refresh}:{row:Destination;refresh:()=>Promise<unknown>}){
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function decide(action:string){setBusy(true);setError("");try{await api("/api/admin/driver-payout-destinations",{method:"POST",body:{id:row.id,expectedVersion:row.version,action,note}});await refresh();}catch(e){setError(e instanceof Error?e.message:"Review failed.");}finally{setBusy(false);}}
  return <section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{row.driver.name}</h2><p>{row.accountName} · {row.phone}</p><p className="text-sm">{row.status.replaceAll("_"," ")} · Driver {row.driver.status}</p>{row.reviewNote&&<p>{row.reviewNote}</p>}
    {row.status==="pending_review"&&<><p className="text-sm">Verify account ownership and the M-Pesa registered name against approved identity evidence before approving. This records a staff decision; it is not an automated provider identity check.</p><label className="block">Verification note<textarea className="mt-1 w-full rounded-lg border bg-background p-3" value={note} onChange={e=>setNote(e.target.value.slice(0,500))} disabled={busy}/></label><div className="flex gap-2"><Button onClick={()=>decide("approve")} disabled={busy||note.trim().length<5||row.driver.status!=="active"}>Approve beneficiary</Button><Button variant="outline" onClick={()=>decide("reject")} disabled={busy||note.trim().length<5}>Request correction</Button></div></>}{error&&<p role="alert">{error}</p>}</section>;
}
export default function Beneficiaries(){const {data,error,refresh}=useAdminData<{destinations:Destination[]}>("/api/admin/driver-payout-destinations");return <div className="space-y-4"><h1 className="text-2xl font-bold">Driver payout beneficiaries</h1><p>Finance approval is required before B2C transfers can leave the platform.</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading beneficiaries…</p>}{data?.destinations.map(row=><Review key={row.id} row={row} refresh={refresh}/>)}{data?.destinations.length===0&&<p>No beneficiary requests yet.</p>}</div>;}
