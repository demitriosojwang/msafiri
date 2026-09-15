'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAGES, TRAINS, TRAINS_BY_DIR } from '@/lib/feeder/seed';
import { useFeederStore } from '@/store/feeder-store';
import {
  Train as TrainIcon,
  MapPin,
  Users,
  Car,
  Crown,
  AlertTriangle,
  TrendingUp,
  Activity,
  Clock,
  Navigation,
  Anchor,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Ruler,
  Shield,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function AdminView() {
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const requests = useFeederStore(s => s.requests);
  const settings = useFeederStore(s => s.settings);
  const [tab, setTab] = useState<'arrivals' | 'departures' | 'stages' | 'charters' | 'autoassign' | 'revenue' | 'audit'>('arrivals');

  // Aggregate metrics
  const metrics = useMemo(() => {
    const activeCabs = cabs.filter(c => c.status === 'filling' || c.status === 'locked');
    const totalSeats = cabs.reduce((s, c) => s + c.capacity, 0);
    const bookedSeats = cabs.reduce((s, c) => s + c.bookedSeats, 0);
    const charterCabs = cabs.filter(c => c.charterLocked).length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const revenue = bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((s, b) => s + b.farePaid, 0);
    const unassignedBookings = bookings.filter(b => !b.cabId && b.status !== 'cancelled').length;

    return {
      activeCabs: activeCabs.length,
      totalCabs: cabs.length,
      totalSeats,
      bookedSeats,
      fillPct: totalSeats > 0 ? bookedSeats / totalSeats : 0,
      charterCabs,
      pendingRequests,
      revenue,
      unassignedBookings,
    };
  }, [cabs, bookings, requests]);

  // Stage coverage analysis — surfaces coverage gaps
  const stageCoverage = useMemo(() => {
    return STAGES.map(stage => {
      const inboundCabs = cabs.filter(c =>
        c.stageId === stage.id && c.direction === 'inbound' && c.status === 'filling',
      );
      const outboundCabs = cabs.filter(c =>
        c.stageId === stage.id && c.direction === 'outbound' && c.status === 'filling',
      );
      const waitingPassengers = requests
        .filter(r => r.status === 'pending' && r.stageId === stage.id)
        .reduce((sum, r) => sum + r.seatsRequested, 0);
      const bookedPassengers = bookings
        .filter(b => b.status !== 'cancelled' && b.stageId === stage.id)
        .reduce((sum, b) => sum + b.seatsReserved, 0);

      const hasCoverage = inboundCabs.length > 0 || outboundCabs.length > 0;
      const hasGap = waitingPassengers > 0 && !hasCoverage;

      return {
        stage,
        inboundCabs: inboundCabs.length,
        outboundCabs: outboundCabs.length,
        waitingPassengers,
        bookedPassengers,
        hasCoverage,
        hasGap,
      };
    });
  }, [cabs, bookings, requests]);

  const gapStages = stageCoverage.filter(s => s.hasGap);
  const coveredStages = stageCoverage.filter(s => s.hasCoverage && !s.hasGap);
  const emptyStages = stageCoverage.filter(s => !s.hasCoverage && s.waitingPassengers === 0);

  // Charter overview
  const charterBookings = bookings.filter(b => b.kind === 'charter' && b.status !== 'cancelled');
  const charterRequests = requests.filter(r => r.kind === 'charter');

  return (
    <div className="space-y-4 pb-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Car className="w-4 h-4" />}
          label="Active cabs"
          value={`${metrics.activeCabs}/${metrics.totalCabs}`}
          sub={`${metrics.bookedSeats}/${metrics.totalSeats} seats (${Math.round(metrics.fillPct * 100)}%)`}
        />
        <MetricCard
          icon={<CircleDollarSign className="w-4 h-4" />}
          label="Revenue today"
          value={`KSh ${metrics.revenue.toLocaleString()}`}
          sub={`${metrics.charterCabs} charter${metrics.charterCabs !== 1 ? 's' : ''} active`}
        />
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Unassigned bookings"
          value={String(metrics.unassignedBookings)}
          sub="waiting for auto-assignment"
          subClass={metrics.unassignedBookings > 0 ? 'text-amber-700' : ''}
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Coverage gaps"
          value={String(gapStages.length)}
          sub="stages with waiting pax, no cab"
          subClass={gapStages.length > 0 ? 'text-destructive' : ''}
        />
      </div>

      {/* Coverage gap alert */}
      {gapStages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-destructive">
                    {gapStages.length} stage{gapStages.length > 1 ? 's' : ''} with coverage gap
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Passengers waiting but no cab assigned. Consider redistributing drivers from over-served stages.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {gapStages.map(g => (
                      <span key={g.stage.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-destructive/10 text-destructive border border-destructive/20">
                        <MapPin className="w-2.5 h-2.5" />
                        {g.stage.name} ({g.waitingPassengers} pax)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="arrivals" className="text-[10px] flex items-center gap-0.5">
            <Anchor className="w-3 h-3" /> Arrivals
          </TabsTrigger>
          <TabsTrigger value="departures" className="text-[10px] flex items-center gap-0.5">
            <Navigation className="w-3 h-3" /> Departs
          </TabsTrigger>
          <TabsTrigger value="stages" className="text-[10px] flex items-center gap-0.5">
            <MapPin className="w-3 h-3" /> Stages
          </TabsTrigger>
          <TabsTrigger value="charters" className="text-[10px] flex items-center gap-0.5">
            <Crown className="w-3 h-3" /> Charters
          </TabsTrigger>
          <TabsTrigger value="autoassign" className="text-[10px] flex items-center gap-0.5">
            <Zap className="w-3 h-3" /> Auto
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-[10px] flex items-center gap-0.5">
            <CircleDollarSign className="w-3 h-3" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-[10px] flex items-center gap-0.5">
            <Shield className="w-3 h-3" /> Audit
          </TabsTrigger>
        </TabsList>

        {/* Arrivals monitoring — the core admin view */}
        <TabsContent value="arrivals" className="mt-3 space-y-3">
          <ArrivalsMonitoring />
        </TabsContent>

        <TabsContent value="departures" className="mt-3 space-y-3">
          <DeparturesMonitoring />
        </TabsContent>

        {/* Stages overview */}
        <TabsContent value="stages" className="mt-3 space-y-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Stage coverage map</h3>
            <p className="text-[11px] text-muted-foreground">
              Each stage's cab allocation and waiting passengers. Coverage gaps are highlighted.
            </p>
            {stageCoverage.map(({ stage, inboundCabs, outboundCabs, waitingPassengers, bookedPassengers, hasGap, hasCoverage }) => (
              <Card
                key={stage.id}
                className={cn(
                  hasGap && 'border-destructive/30 bg-destructive/5',
                  !hasCoverage && !hasGap && 'opacity-60',
                )}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{stage.name}</span>
                        {stage.coast === 'south' ? (
                          <Badge variant="secondary" className="text-[9px] h-4 uppercase">South</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] h-4 uppercase">North</Badge>
                        )}
                        {hasGap && (
                          <Badge variant="destructive" className="text-[9px] h-4 gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Gap
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {stage.area} · ~{stage.travelMin}m from terminus
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <Stat label="Inbound cabs" value={String(inboundCabs)} icon={<Navigation className="w-3 h-3" />} />
                    <Stat label="Outbound cabs" value={String(outboundCabs)} icon={<Anchor className="w-3 h-3" />} />
                    <Stat label="Booked pax" value={String(bookedPassengers)} icon={<CheckCircle2 className="w-3 h-3" />} />
                    <Stat label="Waiting" value={String(waitingPassengers)} icon={<Clock className="w-3 h-3" />} highlight={waitingPassengers > 0} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Charters overview */}
        <TabsContent value="charters" className="mt-3 space-y-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-violet-600" /> Charter bookings
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Private whole-vehicle bookings. Drivers who accept charters are locked out of pooling.
            </p>
            {charterBookings.length === 0 && charterRequests.filter(r => r.status === 'pending').length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No charter activity yet.
                </CardContent>
              </Card>
            )}
            {charterBookings.map(b => {
              const cab = cabs.find(c => c.id === b.cabId);
              const stage = STAGES.find(s => s.id === b.stageId);
              const train = cab ? TRAINS.find(t => t.id === cab.trainId) : null;
              return (
                <Card key={b.id} className="border-violet-300">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                          <span className="font-medium text-sm truncate">{b.passengerName}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {cab?.cabType} · {cab?.plateNumber} · {cab?.driverName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {stage?.name} · {train?.code} {train?.time}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary tabular-nums">KSh {b.farePaid.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">{b.seatsReserved} seats</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {charterRequests.filter(r => r.status === 'pending').length > 0 && (
              <>
                <div className="pt-2 text-xs font-medium text-muted-foreground">Pending charter requests</div>
                {charterRequests.filter(r => r.status === 'pending').map(r => {
                  const stage = STAGES.find(s => s.id === r.stageId);
                  const train = TRAINS.find(t => t.id === r.trainId);
                  return (
                    <Card key={r.id} className="border-violet-200 bg-violet-50/30 border-dashed">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              <span className="font-medium text-sm">{r.passengerName}</span>
                              <Badge variant="secondary" className="text-[9px] h-4">Awaiting driver</Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {stage?.name} · {train?.code} {train?.time} · {r.seatsRequested} seats
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="autoassign" className="mt-3 space-y-3">
          <AutoAssignPanel />
        </TabsContent>

        <TabsContent value="revenue" className="mt-3 space-y-3">
          <RevenuePanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-3 space-y-3">
          <AuditLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RevenuePanel() {
  const bookings = useFeederStore(s => s.bookings);
  const payments = useFeederStore(s => s.payments);
  const receipts = useFeederStore(s => s.receipts);
  const cabs = useFeederStore(s => s.cabs);
  const logAction = useFeederStore(s => s.logAction);
  const { toast } = useToast();
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Revenue metrics
  const confirmedPayments = payments.filter(p => p.status === 'confirmed');
  const totalRevenue = confirmedPayments.reduce((s, p) => s + p.amountKSh, 0);
  const pendingPayments = payments.filter(p => p.status === 'stk_push_sent' || p.status === 'pending');
  const failedPayments = payments.filter(p => p.status === 'failed');
  const refundedPayments = payments.filter(p => p.status === 'refunded');
  const totalRefunded = refundedPayments.reduce((s, p) => s + p.amountKSh, 0);
  const netRevenue = totalRevenue - totalRefunded;

  // Payment status breakdown
  const statusCounts = {
    confirmed: confirmedPayments.length,
    pending: pendingPayments.length,
    failed: failedPayments.length,
    refunded: refundedPayments.length,
  };

  function handleRefund() {
    if (!refundPaymentId || !refundReason.trim()) return;
    // In production, this calls POST /api/v1/admin/refunds
    // which calls M-Pesa's refund API and records the refund
    const payment = payments.find(p => p.id === refundPaymentId);
    if (payment) {
      logAction('admin.refund', 'payment', refundPaymentId, {
        amount: payment.amountKSh,
        reason: refundReason,
      });
      toast({
        title: 'Refund initiated',
        description: `KSh ${payment.amountKSh.toLocaleString()} refund for ${payment.id}. In production, this triggers the M-Pesa refund API.`,
      });
    }
    setRefundPaymentId(null);
    setRefundReason('');
  }

  return (
    <div className="space-y-3">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-emerald-700 tracking-wide">Net Revenue</div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">KSh {netRevenue.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{confirmedPayments.length} payments confirmed</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-amber-700 tracking-wide">Pending</div>
            <div className="text-xl font-bold text-amber-700 tabular-nums">KSh {pendingPayments.reduce((s, p) => s + p.amountKSh, 0).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{pendingPayments.length} payments in progress</div>
          </CardContent>
        </Card>
      </div>

      {/* Payment status breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
              <div className="text-lg font-bold text-emerald-700 tabular-nums">{statusCounts.confirmed}</div>
              <div className="text-[9px] text-muted-foreground">Confirmed</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
              <div className="text-lg font-bold text-amber-700 tabular-nums">{statusCounts.pending}</div>
              <div className="text-[9px] text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-2">
              <div className="text-lg font-bold text-red-600 tabular-nums">{statusCounts.failed}</div>
              <div className="text-[9px] text-muted-foreground">Failed</div>
            </div>
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-2">
              <div className="text-lg font-bold text-violet-600 tabular-nums">{statusCounts.refunded}</div>
              <div className="text-[9px] text-muted-foreground">Refunded</div>
            </div>
          </div>
          {totalRefunded > 0 && (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Total refunded: KSh {totalRefunded.toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All payments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Transactions ({payments.length})</span>
            <Badge variant="secondary" className="text-[10px]">{receipts.length} receipts issued</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          {payments.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              No payments yet.
            </div>
          )}
          {payments.slice().reverse().map(p => {
            const booking = bookings.find(b => b.id === p.bookingId);
            const receipt = receipts.find(r => r.paymentId === p.id);
            const cab = booking?.cabId ? cabs.find(c => c.id === booking.cabId) : null;
            return (
              <div key={p.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-secondary/30 text-xs border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{booking?.passengerName ?? 'Unknown'}</span>
                    {p.status === 'confirmed' && <Badge variant="secondary" className="text-[8px] h-3.5 bg-emerald-100 text-emerald-700">Confirmed</Badge>}
                    {p.status === 'stk_push_sent' && <Badge variant="secondary" className="text-[8px] h-3.5 bg-amber-100 text-amber-700">Pending</Badge>}
                    {p.status === 'failed' && <Badge variant="secondary" className="text-[8px] h-3.5 bg-red-100 text-red-700">Failed</Badge>}
                    {p.status === 'refunded' && <Badge variant="secondary" className="text-[8px] h-3.5 bg-violet-100 text-violet-700">Refunded</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.providerTransactionId ? `${p.providerTransactionId} · ` : ''}{p.provider}
                    {cab && ` · ${cab.driverName}`}
                    {receipt && ` · ${receipt.receiptNumber}`}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span className="font-bold tabular-nums">KSh {p.amountKSh.toLocaleString()}</span>
                  {p.status === 'confirmed' && (
                    <button
                      onClick={() => setRefundPaymentId(p.id)}
                      className="text-[9px] text-destructive hover:underline"
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Refund dialog */}
      {refundPaymentId && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertTriangle className="w-4 h-4" /> Initiate Refund
            </div>
            <p className="text-xs text-muted-foreground">
              Refunding KSh {payments.find(p => p.id === refundPaymentId)?.amountKSh.toLocaleString()} for payment {refundPaymentId}.
              This action is irreversible and will be audit-logged.
            </p>
            <Input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason for refund (required)"
              className="h-9"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-9"
                disabled={!refundReason.trim()}
                onClick={handleRefund}
              >
                Confirm refund
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9"
                onClick={() => { setRefundPaymentId(null); setRefundReason(''); }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuditLogPanel() {
  const auditLog = useFeederStore(s => s.auditLog);

  return (
    <div className="space-y-3">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Shield className="w-4 h-4 text-primary" /> Audit Log
          </div>
          <p className="text-xs text-muted-foreground">
            Every state-changing action is logged: who did what, when, and to what.
            In production, this is an append-only PostgreSQL table retained for 7 years.
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">Append-only</div>
              <div className="text-muted-foreground">Never edited or deleted</div>
            </div>
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">7-year retention</div>
              <div className="text-muted-foreground">For disputes & forensics</div>
            </div>
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">IP tracked</div>
              <div className="text-muted-foreground">Server-side capture</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Recent activity</span>
            <Badge variant="secondary" className="text-[10px]">{auditLog.length} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          {auditLog.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">
              No activity logged yet. Log in, book a trip, or run auto-assignment to see entries.
            </div>
          )}
          {auditLog.map(entry => (
            <div key={entry.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-secondary/30 text-xs border-b last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {entry.action}
                  </span>
                  <span className="font-medium">{entry.actorName}</span>
                  <span className="text-[10px] text-muted-foreground">({entry.actorRole})</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {entry.entityType}{entry.entityId ? `: ${entry.entityId}` : ''}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span> · {JSON.stringify(entry.metadata)}</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ArrivalsMonitoring() {
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const requests = useFeederStore(s => s.requests);
  const [selectedTrainId, setSelectedTrainId] = useState(TRAINS_BY_DIR.outbound[1].id);

  const train = TRAINS.find(t => t.id === selectedTrainId)!;
  const trainCabs = cabs.filter(c => c.trainId === selectedTrainId && c.direction === 'outbound');
  const trainRequests = requests.filter(r => r.trainId === selectedTrainId && r.direction === 'outbound');
  const trainBookings = bookings.filter(b =>
    b.status !== 'cancelled' &&
    trainCabs.some(c => c.id === b.cabId),
  );

  // Per-stage breakdown for this arrival
  const stageBreakdown = useMemo(() => {
    return STAGES.map(stage => {
      const stageCabs = trainCabs.filter(c => c.stageId === stage.id);
      const stageBookings = trainBookings.filter(b => b.stageId === stage.id);
      const stageRequests = trainRequests.filter(r => r.stageId === stage.id);
      const bookedSeats = stageCabs.reduce((s, c) => s + c.bookedSeats, 0);
      const totalSeats = stageCabs.reduce((s, c) => s + c.capacity, 0);
      const waitingPax = stageRequests.reduce((s, r) => s + r.seatsRequested, 0);
      const hasGap = waitingPax > 0 && stageCabs.length === 0;
      const hasCharter = stageCabs.some(c => c.charterLocked);

      return { stage, stageCabs, stageBookings, stageRequests, bookedSeats, totalSeats, waitingPax, hasGap, hasCharter };
    }).filter(s => s.stageCabs.length > 0 || s.waitingPax > 0);
  }, [trainCabs, trainBookings, trainRequests]);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Anchor className="w-3.5 h-3.5" /> Monitoring arrivals at
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TRAINS_BY_DIR.outbound.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTrainId(t.id)}
              className={cn(
                'flex-1 min-w-[110px] text-left px-3 py-2 rounded-xl border transition-all',
                selectedTrainId === t.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card hover:bg-accent border-border',
              )}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">Arrives</div>
              <div className="text-lg font-semibold tabular-nums leading-tight">{t.time}</div>
              <div className="text-[10px] opacity-70 truncate">{t.code}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary for this arrival */}
      <Card>
        <CardContent className="p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Cabs positioned</div>
            <div className="text-xl font-bold tabular-nums">{trainCabs.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Seats booked</div>
            <div className="text-xl font-bold tabular-nums">
              {trainCabs.reduce((s, c) => s + c.bookedSeats, 0)}/{trainCabs.reduce((s, c) => s + c.capacity, 0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Pending requests</div>
            <div className="text-xl font-bold tabular-nums">{trainRequests.filter(r => r.status === 'pending').length}</div>
          </div>
        </CardContent>
      </Card>

      {/* Per-stage breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Stage-by-stage breakdown
        </h4>
        {stageBreakdown.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No cab positioning or waiting passengers for this arrival.
            </CardContent>
          </Card>
        )}
        {stageBreakdown.map(({ stage, stageCabs, bookedSeats, totalSeats, waitingPax, hasGap, hasCharter }) => (
          <Card
            key={stage.id}
            className={cn(
              hasGap && 'border-destructive/30 bg-destructive/5',
              hasCharter && 'border-violet-300',
            )}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{stage.name}</span>
                    {stage.coast === 'south' ? (
                      <Badge variant="secondary" className="text-[9px] h-4 uppercase">South</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] h-4 uppercase">North</Badge>
                    )}
                    {hasGap && (
                      <Badge variant="destructive" className="text-[9px] h-4 gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> No cab
                      </Badge>
                    )}
                    {hasCharter && (
                      <Badge className="text-[9px] h-4 gap-0.5 bg-violet-100 text-violet-800 hover:bg-violet-100">
                        <Crown className="w-2.5 h-2.5" /> Charter
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {stage.area} · ~{stage.travelMin}m
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">Booked</div>
                  <div className="font-bold tabular-nums">{bookedSeats}/{totalSeats}</div>
                </div>
              </div>
              {/* Cab chips */}
              <div className="flex flex-wrap gap-1">
                {stageCabs.map(cab => (
                  <span
                    key={cab.id}
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border',
                      cab.charterLocked
                        ? 'bg-violet-50 text-violet-900 border-violet-200'
                        : 'bg-secondary text-foreground border-border',
                    )}
                  >
                    <Car className="w-2.5 h-2.5" />
                    {cab.driverName} · {cab.cabType} · {cab.bookedSeats}/{cab.capacity}
                  </span>
                ))}
                {waitingPax > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-amber-50 text-amber-900 border-amber-200">
                    <Clock className="w-2.5 h-2.5" /> {waitingPax} pax waiting
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live activity feed */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Live activity
        </h4>
        <Card>
          <CardContent className="p-3 space-y-1.5">
            {trainRequests.slice(0, 5).map(r => {
              const stage = STAGES.find(s => s.id === r.stageId);
              const minutesAgo = Math.max(1, Math.round((Date.now() - r.createdAt) / 60 / 1000));
              return (
                <div key={r.id} className="flex items-center justify-between text-[11px] py-1 border-b last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.kind === 'charter' ? (
                      <Crown className="w-3 h-3 text-violet-600 shrink-0" />
                    ) : (
                      <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{r.passengerName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground truncate">{stage?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.pickupKind === 'off-stage' && (
                      <span className="text-amber-700 inline-flex items-center gap-0.5">
                        <Ruler className="w-2.5 h-2.5" /> {r.offStageDistanceKm}km
                      </span>
                    )}
                    {r.status === 'pending' && (
                      <Badge variant="secondary" className="text-[9px] h-4">pending {minutesAgo}m</Badge>
                    )}
                    {r.status === 'accepted' && (
                      <Badge variant="default" className="text-[9px] h-4 gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> accepted
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {trainRequests.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-2">
                No activity for this arrival yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeparturesMonitoring() {
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const requests = useFeederStore(s => s.requests);
  const [selectedTrainId, setSelectedTrainId] = useState(TRAINS_BY_DIR.inbound[1].id);

  const train = TRAINS.find(t => t.id === selectedTrainId)!;
  const trainCabs = cabs.filter(c => c.trainId === selectedTrainId && c.direction === 'inbound');
  const trainRequests = requests.filter(r => r.trainId === selectedTrainId && r.direction === 'inbound');

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Navigation className="w-3.5 h-3.5" /> Monitoring departures for
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TRAINS_BY_DIR.inbound.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTrainId(t.id)}
              className={cn(
                'flex-1 min-w-[110px] text-left px-3 py-2 rounded-xl border transition-all',
                selectedTrainId === t.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card hover:bg-accent border-border',
              )}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">Departs</div>
              <div className="text-lg font-semibold tabular-nums leading-tight">{t.time}</div>
              <div className="text-[10px] opacity-70 truncate">{t.code}</div>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Cabs filling</div>
            <div className="text-xl font-bold tabular-nums">{trainCabs.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Seats booked</div>
            <div className="text-xl font-bold tabular-nums">
              {trainCabs.reduce((s, c) => s + c.bookedSeats, 0)}/{trainCabs.reduce((s, c) => s + c.capacity, 0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Pending reqs</div>
            <div className="text-xl font-bold tabular-nums">{trainRequests.filter(r => r.status === 'pending').length}</div>
          </div>
        </CardContent>
      </Card>

      {/* Cab list for this departure */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5" /> Cab status
        </h4>
        {trainCabs.map(cab => {
          const stage = STAGES.find(s => s.id === cab.stageId)!;
          const fillPct = cab.bookedSeats / cab.capacity;
          return (
            <Card key={cab.id} className={cn(cab.charterLocked && 'border-violet-300')}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{cab.driverName}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{cab.plateNumber}</span>
                      {cab.charterLocked && (
                        <Badge className="text-[9px] h-4 gap-0.5 bg-violet-100 text-violet-800 hover:bg-violet-100">
                          <Crown className="w-2.5 h-2.5" /> Charter
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {stage.name} · {cab.cabType}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">Fill</div>
                    <div className={cn(
                      'font-bold tabular-nums',
                      fillPct >= 0.7 ? 'text-emerald-600' : fillPct >= 0.4 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {cab.bookedSeats}/{cab.capacity}
                    </div>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      cab.charterLocked ? 'bg-violet-500' :
                      fillPct >= 0.7 ? 'bg-emerald-500' : fillPct >= 0.4 ? 'bg-amber-500' : 'bg-primary',
                    )}
                    style={{ width: `${fillPct * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {trainCabs.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No cabs posted for this departure.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, subClass }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; subClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
        {sub && (
          <div className={cn('text-[10px] text-muted-foreground', subClass)}>{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon, highlight }: {
  label: string; value: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className="rounded bg-secondary/50 p-1.5">
      <div className={cn('flex items-center gap-1 text-[9px] uppercase', highlight ? 'text-amber-700' : 'text-muted-foreground')}>
        {icon}
        {label}
      </div>
      <div className={cn('font-semibold tabular-nums', highlight && 'text-amber-700')}>{value}</div>
    </div>
  );
}

function AutoAssignPanel() {
  const cabs = useFeederStore(s => s.cabs);
  const bookings = useFeederStore(s => s.bookings);
  const autoAssign = useFeederStore(s => s.autoAssign);
  const { toast } = useToast();
  const [result, setResult] = useState<{ assigned: number; unassigned: number; details: string[] } | null>(null);
  const [selectedTrain, setSelectedTrain] = useState(TRAINS_BY_DIR.inbound[1].id);

  const unassigned = bookings.filter(b => !b.cabId && b.status !== 'cancelled');
  const train = TRAINS.find(t => t.id === selectedTrain)!;
  const trainCabs = cabs.filter(c => c.trainId === selectedTrain && c.status === 'filling' && !c.charterLocked);

  // Driver fairness metrics
  const driverLoad = useMemo(() => {
    return cabs
      .filter(c => c.trainId === selectedTrain)
      .map(cab => {
        const cabBookings = bookings.filter(b => b.cabId === cab.id && b.status !== 'cancelled');
        const seats = cabBookings.reduce((s, b) => s + b.seatsReserved, 0);
        return {
          driver: cab.driverName,
          plate: cab.plateNumber,
          cabType: cab.cabType,
          capacity: cab.capacity,
          booked: seats,
          fillPct: cab.capacity > 0 ? seats / cab.capacity : 0,
          bookingCount: cabBookings.length,
          rating: cab.driverRating,
        };
      })
      .sort((a, b) => b.fillPct - a.fillPct);
  }, [cabs, bookings, selectedTrain]);

  function handleAutoAssign() {
    const res = autoAssign(selectedTrain);
    setResult(res);
    toast({
      title: `Auto-assignment complete`,
      description: `${res.assigned} booking${res.assigned !== 1 ? 's' : ''} assigned${res.unassigned > 0 ? `, ${res.unassigned} could not be placed` : ''}`,
      variant: res.unassigned > 0 ? 'destructive' : 'default',
    });
  }

  return (
    <div className="space-y-3">
      {/* How it works */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Zap className="w-4 h-4 text-primary" /> Auto-Allocation Engine
          </div>
          <p className="text-xs text-muted-foreground">
            The system automatically assigns unassigned bookings to available cabs using a fairness-aware algorithm.
            Emptier cabs driven by drivers who haven't been assigned recently (and have good ratings) get priority —
            so no single driver dominates demand.
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">Load balancing</div>
              <div className="text-muted-foreground">Emptier cabs filled first</div>
            </div>
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">Recency penalty</div>
              <div className="text-muted-foreground">Just-assigned drivers wait</div>
            </div>
            <div className="rounded bg-card border p-2">
              <div className="font-medium text-foreground">Rating bonus</div>
              <div className="text-muted-foreground">Small edge for top drivers</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Train selector */}
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          <TrainIcon className="w-3.5 h-3.5" /> Run auto-assignment for
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TRAINS.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelectedTrain(t.id); setResult(null); }}
              className={cn(
                'flex-1 min-w-[120px] text-left px-3 py-2 rounded-xl border transition-all',
                selectedTrain === t.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card hover:bg-accent border-border',
              )}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">
                {t.direction === 'inbound' ? 'Departs' : 'Arrives'}
              </div>
              <div className="text-lg font-semibold tabular-nums leading-tight">{t.time}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Unassigned bookings for this train */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Unassigned bookings
            </span>
            <Badge variant="secondary" className="text-[10px]">{unassigned.length} pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          {unassigned.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
              All bookings assigned!
            </div>
          )}
          {unassigned.map(b => {
            const stage = STAGES.find(s => s.id === b.stageId);
            return (
              <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.passengerName}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" /> {stage?.name ?? b.pickupPoint}
                    {b.vehicleTypePreference && (
                      <span className="text-muted-foreground/50">·</span>
                    )}
                    {b.vehicleTypePreference && <span>Prefers {b.vehicleTypePreference}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[9px] h-4">{b.seatsReserved} seat{b.seatsReserved > 1 ? 's' : ''}</Badge>
                  <span className="text-[10px] font-medium tabular-nums">KSh {b.farePaid}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Run button */}
      <Button
        className="w-full h-12"
        onClick={handleAutoAssign}
        disabled={unassigned.length === 0 || trainCabs.length === 0}
      >
        <Zap className="w-4 h-4 mr-1.5" />
        Run auto-assignment for {train.time} {train.direction === 'inbound' ? 'departure' : 'arrival'}
      </Button>
      {(unassigned.length === 0 || trainCabs.length === 0) && (
        <p className="text-[11px] text-center text-muted-foreground">
          {unassigned.length === 0
            ? 'No unassigned bookings to allocate.'
            : `No available cabs for this train.`}
        </p>
      )}

      {/* Results */}
      {result && (
        <Card className={cn(result.unassigned > 0 ? 'border-amber-300' : 'border-emerald-300')}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {result.unassigned > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {result.assigned} assigned
              {result.unassigned > 0 && `, ${result.unassigned} unplaced`}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.details.map((d, i) => (
                <div key={i} className="text-[11px] font-mono leading-relaxed">
                  {d}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver fairness dashboard */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Driver load distribution
        </h4>
        <p className="text-[11px] text-muted-foreground">
          Fairness check — each driver's current load for this train. The algorithm balances these.
        </p>
        {driverLoad.map(d => (
          <Card key={d.plate}>
            <CardContent className="p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{d.driver}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {d.cabType} · {d.plate} · ★ {d.rating.toFixed(1)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold tabular-nums">{d.booked}/{d.capacity}</div>
                  <div className="text-[10px] text-muted-foreground">{d.bookingCount} booking{d.bookingCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    d.fillPct >= 0.9 ? 'bg-emerald-500' :
                    d.fillPct >= 0.5 ? 'bg-amber-500' : 'bg-primary',
                  )}
                  style={{ width: `${d.fillPct * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {driverLoad.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No cabs for this train.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
