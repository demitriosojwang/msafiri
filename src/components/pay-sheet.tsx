"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ksh } from "@/lib/format";
import { api } from "@/lib/client";
import { Loader2, MessageSquareText, Phone, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";

interface PaySheetProps {
  open: boolean;
  onClose: () => void;
  booking: { id: string; code: string; cashDue: number; routeName?: string | null; departureAt?: string | null; stageName?: string | null };
  onPaid: () => void;
}

export function PaySheet({ open, onClose, booking, onPaid }: PaySheetProps) {
  const [step, setStep] = useState<"phone" | "stk" | "verifying" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ receipt: string; amount: number } | null>(null);

  useEffect(() => {
    if (open) {
      setStep("phone");
      setPhone("");
      setError(null);
      setReceipt(null);
    }
  }, [open, booking.id]);

  async function sendPrompt() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/bookings/${booking.id}`, {
        body: { action: "pay", phone },
      });
      setStep("stk");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send prompt");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setStep("verifying");
    try {
      const res = await api<{ receipt: string; amount: number }>(`/api/bookings/${booking.id}`, {
        body: { action: "verify" },
      });
      setReceipt({ receipt: res.receipt, amount: res.amount });
      setStep("done");
      onPaid();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setStep("stk");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby="pay-desc">
        {step === "phone" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" /> Pay with M-Pesa
              </DialogTitle>
              <DialogDescription id="pay-desc">
                {booking.code} · {ksh(booking.cashDue)} via Lipa na M-Pesa (STK push). Your money
                is held by the platform until your ride is delivered.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mpesa-phone">M-Pesa number</Label>
                <Input
                  id="mpesa-phone"
                  placeholder="07XX XXX XXX or 2547XX XXX XXX"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={sendPrompt} disabled={busy || phone.length < 9}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send M-Pesa prompt · ${ksh(booking.cashDue)}`}
              </Button>
            </div>
          </>
        )}

        {step === "stk" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" /> Check your phone
              </DialogTitle>
              <DialogDescription id="pay-desc">
                An M-Pesa prompt has been sent to {phone}. Enter your PIN on the prompt, then
                confirm below.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="relative grid h-20 w-20 place-items-center rounded-full bg-emerald-100">
                <MessageSquareText className="h-9 w-9 text-primary" />
                <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-emerald-200/60" />
              </span>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={verify}>
                I&apos;ve paid — verify
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep("phone")}>
                Use a different number
              </Button>
            </div>
          </>
        )}

        {step === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying payment…</p>
          </div>
        )}

        {step === "done" && receipt && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" /> Payment received
              </DialogTitle>
              <DialogDescription id="pay-desc">
                Your seat is confirmed. The money sits in the Mi-Reli ledger until your ride is
                delivered — never with the driver directly.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <ReceiptText className="h-4 w-4 text-primary" /> Receipt {booking.code}
              </p>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">M-Pesa code</span>
                <span className="text-right font-mono font-medium">{receipt.receipt}</span>
                <span className="text-muted-foreground">Amount paid</span>
                <span className="text-right font-medium">{ksh(receipt.amount)}</span>
                {booking.routeName && (
                  <>
                    <span className="text-muted-foreground">Route</span>
                    <span className="text-right font-medium">{booking.routeName}</span>
                  </>
                )}
                {booking.stageName && (
                  <>
                    <span className="text-muted-foreground">Pickup</span>
                    <span className="text-right font-medium">{booking.stageName}</span>
                  </>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
