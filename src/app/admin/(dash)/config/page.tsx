"use client";

import { useEffect, useState } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { fmtDateTime } from "@/lib/format";
import { Save } from "lucide-react";

interface ConfigData {
  config: {
    commissionRate: number;
    fullRefundCutoffMinutes: number;
    seatFillThresholdPercent: number;
    creditValidityDays: number;
    payoutMode: string;
    payoutDay: number;
    stuckRefundHours: number;
    stuckPayoutHours: number;
    sweepPendingMinutes: number;
    tripHorizonDays: number;
    bookingWindowMinutes: number;
    adminEmails: string[];
    admin2faCode: string;
  };
  ntsaCap: number;
  lastPayoutRunAt: string | null;
  lastReconciliationAt: string | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminConfig() {
  const { toast } = useToast();
  const { data, refresh } = useAdminData<ConfigData>("/api/admin/config");
  const [form, setForm] = useState<ConfigData["config"] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data]);

  if (!form) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/config", { method: "PUT", body: form });
      toast({ title: "Config saved", description: "Changes apply to every new booking, cancellation and payout batch immediately." });
      refresh();
    } catch (e) {
      toast({ title: "Rejected", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const num = (v: string) => (v === "" ? 0 : parseInt(v, 10) || 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Config</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These levers drive every money decision — refund tiers, credit validity, commission and
          payout timing. Policy is config-driven, never hardcoded per transaction.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission & refunds</CardTitle>
            <CardDescription>
              The commission rate must stay under the NTSA {(data?.ntsaCap * 100).toFixed(0)}% cap —
              the API rejects anything higher.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-rate">Commission rate (0–0.18)</Label>
              <Input
                id="c-rate"
                type="number"
                step="0.01"
                min="0"
                max="0.18"
                value={form.commissionRate}
                onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Charged on (fare − home surcharge) at trip completion. Current: {(form.commissionRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-cutoff">Full-refund cutoff (min before departure)</Label>
                <Input id="c-cutoff" inputMode="numeric" value={form.fullRefundCutoffMinutes} onChange={(e) => setForm({ ...form, fullRefundCutoffMinutes: num(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fill">Seat-fill lock threshold (%)</Label>
                <Input id="c-fill" inputMode="numeric" value={form.seatFillThresholdPercent} onChange={(e) => setForm({ ...form, seatFillThresholdPercent: num(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-credit">Credit validity (days)</Label>
              <Input
                id="c-credit"
                inputMode="numeric"
                value={form.creditValidityDays}
                onChange={(e) => setForm({ ...form, creditValidityDays: num(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Late-cancellation credits stay redeemable this long (currently {form.creditValidityDays} days).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payouts</CardTitle>
            <CardDescription>
              Weekly batch is the confirmed model (mirrors Uber/Bolt in Kenya). Instant mode fires
              B2C the moment a trip completes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payout mode</Label>
              <Select value={form.payoutMode} onValueChange={(v) => setForm({ ...form, payoutMode: v })}>
                <SelectTrigger aria-label="Payout mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly batch (default)</SelectItem>
                  <SelectItem value="daily">Daily batch</SelectItem>
                  <SelectItem value="instant_per_trip">Instant per trip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payout day (weekly mode)</Label>
              <Select value={String(form.payoutDay)} onValueChange={(v) => setForm({ ...form, payoutDay: parseInt(v, 10) })}>
                <SelectTrigger aria-label="Payout day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Last run: {data?.lastPayoutRunAt ? fmtDateTime(data.lastPayoutRunAt) : "never"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-stuck-r">Stuck-refund alert (hours)</Label>
                <Input id="c-stuck-r" inputMode="numeric" value={form.stuckRefundHours} onChange={(e) => setForm({ ...form, stuckRefundHours: num(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-stuck-p">Stuck-payout alert (hours)</Label>
                <Input id="c-stuck-p" inputMode="numeric" value={form.stuckPayoutHours} onChange={(e) => setForm({ ...form, stuckPayoutHours: num(e.target.value) })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-sweep">Sweep threshold (min)</Label>
              <Input id="c-sweep" inputMode="numeric" value={form.sweepPendingMinutes} onChange={(e) => setForm({ ...form, sweepPendingMinutes: num(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-horizon">Trip horizon (days)</Label>
              <Input id="c-horizon" inputMode="numeric" value={form.tripHorizonDays} onChange={(e) => setForm({ ...form, tripHorizonDays: num(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-window">Booking window (min before departure)</Label>
              <Input id="c-window" inputMode="numeric" value={form.bookingWindowMinutes} onChange={(e) => setForm({ ...form, bookingWindowMinutes: num(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-2fa">Admin access code (2nd factor)</Label>
              <Input id="c-2fa" value={form.admin2faCode} onChange={(e) => setForm({ ...form, admin2faCode: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin identities</CardTitle>
            <CardDescription>
              Emails recognised as admin at the ops console login. Admin access is granted by
              identity, never by a signup flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {form.adminEmails.map((email, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={email}
                  onChange={(e) => {
                    const next = [...form.adminEmails];
                    next[i] = e.target.value;
                    setForm({ ...form, adminEmails: next });
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setForm({ ...form, adminEmails: form.adminEmails.filter((_, j) => j !== i) })}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm({ ...form, adminEmails: [...form.adminEmails, ""] })}
            >
              Add admin email
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button onClick={save} disabled={busy} size="lg">
        <Save className="h-4 w-4" /> Save config
      </Button>
    </div>
  );
}
