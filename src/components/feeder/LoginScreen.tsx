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
} from 'lucide-react';

export function LoginScreen() {
  const login = useFeederStore(s => s.login);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState(false);

  // Detect if input looks like email or phone
  const isEmail = identifier.includes('@');

  function handleSendOtp() {
    // Validate: email must have @, phone must be 10+ digits
    const isValid = isEmail
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
      : identifier.replace(/\D/g, '').length >= 10;
    if (!isValid) {
      setError(true);
      return;
    }
    setError(false);
    setOtpSent(true);
    // In production, this calls POST /auth/otp/send which triggers an SMS or email
  }

  function handleVerifyOtp() {
    if (otp.length < 4) {
      setError(true);
      return;
    }
    // In production, this calls POST /auth/otp/verify which returns a JWT
    // The backend checks the email/phone against the admin whitelist and driver registry
    // If it matches an admin email → admin session with admin permissions
    // If it matches a driver phone → driver session with driver permissions
    // Otherwise → passenger session
    login(identifier);
  }

  function reset() {
    setIdentifier('');
    setOtp('');
    setOtpSent(false);
    setError(false);
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

        {/* Unified login — no role selection */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-4"
        >
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
                  onChange={(e) => { setIdentifier(e.target.value); setError(false); }}
                  placeholder="you@example.com or +254 7XX XXX XXX"
                  className="h-11"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                />
              </div>
              {error && <p className="text-xs text-destructive">Enter a valid email or phone number</p>}
              <Button className="w-full h-11" onClick={handleSendOtp}>
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
                  onChange={(e) => { setOtp(e.target.value); setError(false); }}
                  placeholder="••••••"
                  className="h-11 text-center text-lg tracking-[0.5em]"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                />
              </div>
              {error && <p className="text-xs text-destructive">Enter the 4-6 digit code</p>}
              <Button className="w-full h-11" onClick={handleVerifyOtp}>
                Verify & log in <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Demo: any code works. In production, this is sent via SMS or email.
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
            <span>Your account is recognised automatically — no role selection needed.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Drivers and passengers see only their own data. Admin access is granted by email, not by button.</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 text-center text-[10px] text-muted-foreground">
        msafiri · Mombasa Terminus · Kenya Coast
      </div>
    </div>
  );
}
