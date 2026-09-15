'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeederStore } from '@/store/feeder-store';
import {
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  Lock,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isValidIdentifier,
  fmtLockoutRemaining,
  OTP_MAX_ATTEMPTS,
  type AuditEntry,
} from '@/lib/feeder/security';

export function LoginScreen() {
  const loginWith2FA = useFeederStore(s => s.loginWith2FA);
  const checkRateLimit = useFeederStore(s => s.checkRateLimit);
  const needs2FA = useFeederStore(s => s.needs2FA);
  const loginAttempts = useFeederStore(s => s.loginAttempts);

  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMs, setRateLimitMs] = useState(0);

  const isEmail = identifier.includes('@');

  function handleSendOtp() {
    if (!isValidIdentifier(identifier)) {
      setError('Enter a valid email or phone number');
      return;
    }

    // Check rate limit
    const rateCheck = checkRateLimit(identifier);
    if (rateCheck.limited) {
      setRateLimited(true);
      setRateLimitMs(rateCheck.remainingMs);
      setError(`Too many attempts. Try again in ${fmtLockoutRemaining(rateCheck.remainingMs)}.`);
      return;
    }

    setError(null);
    setOtpSent(true);
    // In production: POST /auth/otp/send
    // The server returns the SAME response regardless of whether the email exists
    // (anti-enumeration). The OTP is only sent if the email is registered.
    // For the prototype, we proceed regardless.
  }

  function handleVerifyOtp() {
    if (otp.length < 4) {
      setError('Enter the 4-6 digit code');
      return;
    }

    // If 2FA is required (admin), check the 2FA code
    const result = loginWith2FA(identifier, otp, needs2FA ? twoFactorCode : undefined);

    if (!result.success) {
      setError(result.error || 'Verification failed');
      if (result.error?.includes('Too many') || result.error?.includes('attempts')) {
        setRateLimited(true);
        const rateCheck = checkRateLimit(identifier);
        if (rateCheck.limited) {
          setRateLimitMs(rateCheck.remainingMs);
        }
      }
      return;
    }

    // Success — the store handles the session creation
  }

  function reset() {
    setIdentifier('');
    setOtp('');
    setTwoFactorCode('');
    setOtpSent(false);
    setError(null);
    setRateLimited(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl mb-6"
        >
          <img src="/msafiri-logo.png" alt="msafiri" className="w-full h-full object-cover" />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">msafiri</h1>
        <p className="text-sm text-muted-foreground mb-8">Ride · Connect · Journey</p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-4"
        >
          {/* Rate limit banner */}
          {rateLimited && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Account temporarily locked</div>
                <div className="mt-0.5 opacity-90">
                  Too many failed attempts. Try again in {fmtLockoutRemaining(rateLimitMs)}.
                </div>
              </div>
            </div>
          )}

          {/* Remaining attempts warning */}
          {otpSent && !rateLimited && loginAttempts.remaining < OTP_MAX_ATTEMPTS && loginAttempts.remaining > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{loginAttempts.remaining} attempt{loginAttempts.remaining !== 1 ? 's' : ''} remaining before lockout.</span>
            </div>
          )}

          {!otpSent ? (
            <>
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold">Welcome</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Log in with your email or phone number
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  {isEmail ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                  Email or phone
                </Label>
                <Input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                  placeholder="you@example.com or +254 7XX XXX XXX"
                  className="h-11"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  disabled={rateLimited}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full h-11" onClick={handleSendOtp} disabled={rateLimited}>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold">Verify</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the code sent to {identifier}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Verification code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value); setError(null); }}
                  placeholder="••••••"
                  className={cn('h-11 text-center text-lg tracking-[0.5em]', error && 'border-destructive')}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  disabled={rateLimited}
                />
              </div>

              {/* Admin 2FA prompt — only appears if the system detected an admin email */}
              {needs2FA && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/20"
                >
                  <Label className="text-xs flex items-center gap-1 text-primary">
                    <Lock className="w-3 h-3" /> Admin verification (2FA)
                  </Label>
                  <Input
                    type="password"
                    value={twoFactorCode}
                    onChange={(e) => { setTwoFactorCode(e.target.value); setError(null); }}
                    placeholder="Enter admin access code"
                    className="h-11"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Admin accounts require a second verification code. In production, this would be a TOTP code from your authenticator app.
                  </p>
                </motion.div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full h-11" onClick={handleVerifyOtp} disabled={rateLimited}>
                Verify & log in <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Demo: any OTP works. In production, this is sent via SMS or email.
              </p>
            </>
          )}

          {otpSent && (
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Use a different email or phone
            </button>
          )}
        </motion.div>

        {/* Trust indicators */}
        <div className="mt-8 space-y-2 w-full max-w-sm">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Account locked after {OTP_MAX_ATTEMPTS} failed attempts. Sessions expire after 15 min of inactivity.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Admin accounts require 2FA. All actions are audit-logged.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Drivers and passengers see only their own data. Server enforces every permission check.</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 text-center text-[10px] text-muted-foreground">
        msafiri · Mombasa Terminus · Kenya Coast
      </div>
    </div>
  );
}
