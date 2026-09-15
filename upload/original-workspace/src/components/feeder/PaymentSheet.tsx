'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeederStore } from '@/store/feeder-store';
import { STAGES, TRAINS, fmtDateShort } from '@/lib/feeder/seed';
import type { Booking, Receipt } from '@/lib/feeder/types';
import {
  Phone,
  CheckCircle2,
  Clock,
  Loader2,
  Receipt as ReceiptIcon,
  AlertCircle,
  Download,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentStep = 'phone' | 'stk_push' | 'confirming' | 'success' | 'failed';

export function PaymentSheet({ booking, open, onOpenChange }: {
  booking: Booking | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const initiatePayment = useFeederStore(s => s.initiatePayment);
  const confirmPayment = useFeederStore(s => s.confirmPayment);
  const getPaymentForBooking = useFeederStore(s => s.getPaymentForBooking);
  const getReceiptForBooking = useFeederStore(s => s.getReceiptForBooking);
  const submitRating = useFeederStore(s => s.submitRating);
  const getRatingForBooking = useFeederStore(s => s.getRatingForBooking);
  const cabs = useFeederStore(s => s.cabs);

  const [step, setStep] = useState<PaymentStep>('phone');
  const [phone, setPhone] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Reset when booking changes
  useEffect(() => {
    if (booking) {
      const existingPayment = getPaymentForBooking(booking.id);
      if (existingPayment?.status === 'confirmed') {
        setStep('success');
        setReceipt(getReceiptForBooking(booking.id) ?? null);
      } else if (existingPayment?.status === 'stk_push_sent' && step !== 'confirming') {
        // STK push already sent — keep the stk_push step (don't reset to phone)
        setStep('stk_push');
        setPaymentId(existingPayment.id);
      } else if (!existingPayment) {
        // No payment yet — start fresh
        setStep('phone');
        setPaymentId(null);
        setReceipt(null);
        setRating(0);
        setRatingSubmitted(false);
      }
    }
  }, [booking?.id]);

  if (!booking) return null;

  const cab = booking.cabId ? cabs.find(c => c.id === booking.cabId) : null;
  const stage = booking.stageId ? STAGES.find(s => s.id === booking.stageId) : null;
  const train = cab ? TRAINS.find(t => t.id === cab.trainId) : null;

  function handleInitiatePayment() {
    if (!booking || phone.length < 10) return;
    const payment = initiatePayment(booking.id, phone);
    if (payment) {
      setPaymentId(payment.id);
      setStep('stk_push');
    }
  }

  function handleConfirmPayment() {
    if (!paymentId) return;
    setStep('confirming');
    // Simulate M-Pesa callback delay (2 seconds)
    setTimeout(() => {
      const rcpt = confirmPayment(paymentId);
      if (rcpt) {
        setReceipt(rcpt);
        setStep('success');
      } else {
        setStep('failed');
      }
    }, 2000);
  }

  function handleClose(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setStep('phone');
        setPhone('');
        setPaymentId(null);
        setReceipt(null);
        setRating(0);
        setRatingSubmitted(false);
      }, 200);
    }
  }

  function handleSubmitRating() {
    if (!booking || rating === 0) return;
    submitRating(booking.id, rating);
    setRatingSubmitted(true);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {step === 'success' ? 'Payment confirmed' : step === 'failed' ? 'Payment failed' : 'M-Pesa Payment'}
          </SheetTitle>
          <SheetDescription>
            {step === 'success'
              ? 'Your booking is confirmed. Check your receipt below.'
              : step === 'failed'
                ? 'The payment could not be completed. Please try again.'
                : `Pay KSh ${booking.farePaid.toLocaleString()} via M-Pesa for your booking`}
          </SheetDescription>
        </SheetHeader>

        {/* Booking summary */}
        <div className="px-4 pb-2">
          <div className="rounded-lg bg-secondary/60 p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Route</span>
              <span className="font-medium">{stage?.name ?? booking.pickupPoint} → {train?.destination ?? 'Terminus'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Train</span>
              <span className="font-medium">{train?.code} · {train?.time}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{fmtDateShort(useFeederStore.getState().selectedDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seats</span>
              <span className="font-medium">{booking.seatsReserved}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="font-medium">Total</span>
              <span className="font-bold text-primary text-base">KSh {booking.farePaid.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Step: Phone input */}
        {step === 'phone' && (
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" /> M-Pesa phone number
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
                className="h-11"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleInitiatePayment()}
              />
              <p className="text-[10px] text-muted-foreground">
                An STK push will be sent to this number. Enter your M-Pesa PIN on your phone to confirm.
              </p>
            </div>
          </div>
        )}

        {/* Step: STK push sent */}
        {step === 'stk_push' && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Phone className="w-7 h-7 text-emerald-600 msafiri-live-dot" />
              </div>
              <h3 className="font-semibold text-base">Check your phone</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                An M-Pesa prompt has been sent to <span className="font-medium text-foreground">{phone}</span>.
                Enter your M-Pesa PIN to authorize the payment of{' '}
                <span className="font-medium text-foreground">KSh {booking.farePaid.toLocaleString()}</span>.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Simulated payment — click "I've paid" below to simulate the M-Pesa callback. In production, the callback arrives automatically from Safaricom.</span>
            </div>
          </div>
        )}

        {/* Step: Confirming */}
        {step === 'confirming' && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex flex-col items-center text-center py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <h3 className="font-semibold text-base">Verifying payment...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Waiting for M-Pesa confirmation
              </p>
            </div>
          </div>
        )}

        {/* Step: Success — receipt */}
        {step === 'success' && receipt && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-lg">Payment confirmed!</h3>
              <p className="text-sm text-muted-foreground">KSh {receipt.amountKSh.toLocaleString()} paid via M-Pesa</p>
            </div>

            {/* Receipt */}
            <div className="rounded-xl border-2 border-dashed border-border p-4 space-y-2">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded overflow-hidden">
                    <img src="/msafiri-logo.png" alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="font-bold text-sm">msafiri</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Receipt</span>
              </div>

              <div className="space-y-1 text-xs">
                <ReceiptRow label="Receipt #" value={receipt.receiptNumber} mono />
                <ReceiptRow label="Transaction ID" value={receipt.transactionId} mono />
                <ReceiptRow label="Passenger" value={receipt.passengerName} />
                <ReceiptRow label="Route" value={receipt.route} />
                <ReceiptRow label="Train" value={`${receipt.trainCode} · ${receipt.trainTime}`} />
                <ReceiptRow label="Date" value={receipt.date} />
                <ReceiptRow label="Seats" value={String(receipt.seats)} />
                {receipt.driverName && <ReceiptRow label="Driver" value={`${receipt.driverName} · ${receipt.plateNumber}`} />}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold">Total paid</span>
                <span className="font-bold text-primary text-lg">KSh {receipt.amountKSh.toLocaleString()}</span>
              </div>

              <div className="text-center pt-1">
                <p className="text-[10px] text-muted-foreground">
                  Issued {new Date(receipt.issuedAt).toLocaleString('en-GB')}
                </p>
              </div>
            </div>

            {/* Rating prompt (only for completed trips) */}
            {booking.status === 'completed' && !ratingSubmitted && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm font-medium">Rate your trip with {receipt.driverName}</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                        n <= rating
                          ? 'bg-amber-100 text-amber-600 scale-110'
                          : 'bg-secondary text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Star className={cn('w-5 h-5', n <= rating && 'fill-current')} />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <Button className="w-full h-10" onClick={handleSubmitRating}>
                    Submit {rating}-star rating
                  </Button>
                )}
              </div>
            )}
            {ratingSubmitted && (
              <div className="text-center text-sm text-emerald-600 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Thanks for rating!
              </div>
            )}
          </div>
        )}

        {/* Step: Failed */}
        {step === 'failed' && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">Payment failed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The payment could not be completed. This can happen if the M-Pesa prompt was declined or timed out.
              </p>
            </div>
            <Button className="w-full h-11" onClick={() => setStep('phone')}>
              Try again
            </Button>
          </div>
        )}

        {/* Footer buttons */}
        <SheetFooter className="px-4 pb-4">
          {step === 'phone' && (
            <Button
              className="w-full h-11"
              disabled={phone.length < 10}
              onClick={handleInitiatePayment}
            >
              Send M-Pesa prompt · KSh {booking.farePaid.toLocaleString()}
            </Button>
          )}
          {step === 'stk_push' && (
            <Button className="w-full h-11" onClick={handleConfirmPayment}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> I've paid — verify
            </Button>
          )}
          {step === 'success' && (
            <Button className="w-full h-11" onClick={() => handleClose(false)}>
              <ReceiptIcon className="w-4 h-4 mr-1" /> Done
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ReceiptRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}
