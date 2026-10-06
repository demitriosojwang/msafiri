"use client";
import {useState} from "react";
import {useAdminData} from "@/components/admin/use-admin-data";
import {api} from "@/lib/client";
import {Button} from "@/components/ui/button";
type Case={id:string;category:string;message:string;status:string;reply:string|null;version:number;driver:{name:string;phone:string}};
function SupportCard({row,refresh}:{row:Case;refresh:()=>Promise<unknown>}) {
  const [reply,setReply]=useState(row.reply||""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(status:string){setBusy(true);setError("");try{await api("/api/admin/driver-support",{method:"POST",body:{id:row.id,expectedVersion:row.version,reply,status}});await refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to reply.");}finally{setBusy(false);}}
  return <div className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{row.driver.name} · {row.category}</h2><p className="text-xs text-muted-foreground">{row.id} · {row.status} · {row.driver.phone}</p><p className="whitespace-pre-wrap text-sm">{row.message}</p>{error&&<p role="alert">{error}</p>}<label className="block text-sm">Reply to the driver<textarea value={reply} onChange={e=>setReply(e.target.value.slice(0,2000))} className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3" disabled={busy}/></label><div className="flex gap-2"><Button disabled={busy||reply.trim().length<5} onClick={()=>save("investigating")}>Save update</Button><Button variant="outline" disabled={busy||reply.trim().length<5} onClick={()=>save("resolved")}>Resolve case</Button></div></div>;
}
export default function DriverSupport(){const {data,error,refresh}=useAdminData<{cases:Case[]}>("/api/admin/driver-support");return <div className="space-y-4"><h1 className="text-2xl font-bold">Driver support</h1><p className="text-sm text-muted-foreground">Triage payout, document and account issues. Safety cases need immediate escalation through the staffed operations process.</p>{error&&<p role="alert">{error}</p>}{data?.cases.map(row=><SupportCard key={row.id} row={row} refresh={refresh}/>)}{data?.cases.length===0&&<p>No driver cases.</p>}</div>;}
