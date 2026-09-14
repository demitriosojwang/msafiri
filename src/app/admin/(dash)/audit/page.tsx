"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";

interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const roleStyles: Record<string, string> = {
  admin: "bg-emerald-100 text-emerald-900 border-emerald-200",
  passenger: "bg-teal-100 text-teal-900 border-teal-200",
  system: "bg-stone-100 text-stone-700 border-stone-200",
};

export default function AdminAudit() {
  const [role, setRole] = useState("");
  const { data } = useAdminData<{ logs: AuditRow[] }>(`/api/admin/audit${role ? `?role=${role}` : ""}`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only record of every state-changing action — logins, bookings, payments,
          cancellations, config changes and payout runs. The trail you'll want when a dispute lands.
        </p>
      </div>

      <div className="flex gap-1.5">
        {["", "admin", "passenger", "system"].map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${role === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {r || "All"}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        {(data?.logs || []).map((l) => (
          <Card key={l.id}>
            <CardContent className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={roleStyles[l.actorRole] || ""}>{l.actorRole}</Badge>
                  <span className="font-medium">{l.action}</span>
                  <span className="text-xs text-muted-foreground">
                    by {l.actorName} · {l.entity}
                  </span>
                </div>
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(l.metadata)}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(l.createdAt)}</span>
            </CardContent>
          </Card>
        ))}
        {data && data.logs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing logged yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
