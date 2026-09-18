"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client";
import { Mail, Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { LogoTile } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

/**
 * Original-style login: centered logo + wordmark + tagline, identifier → OTP,
 * first-time name capture, trust indicators. Wired to the real /api/auth.
 */
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEmail = identifier.includes("@");

  async function handleSendOtp() {
    if (identifier.trim().length < 5) {
      setError("Enter a valid email or phone number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth", { body: { step: "request", identifier } });
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (code.length !== 4) {
      setError("Enter the 4-digit code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok?: boolean; needsName?: boolean }>("/api/auth", {
        body: { step: "verify", identifier, code, name },
      });
      if (res.needsName) {
        setNeedsName(true);
        setError(null);
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setIdentifier("");
    setCode("");
    setName("");
    setNeedsName(false);
    setOtpSent(false);
    setError(null);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <LogoTile size="lg" />
        </motion.div>
        <h1 className="mb-1 mt-4 text-2xl font-bold tracking-tight">Mi-Reli</h1>
        <p className="mb-8 text-sm text-muted-foreground">Ride · Connect · Journey</p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-4">
          {!otpSent ? (
            <>
              <div className="mb-2 text-center">
                <h2 className="text-lg font-semibold">Welcome</h2>
                <p className="mt-1 text-xs text-muted-foreground">Log in with your email or phone number</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs">
                  {isEmail ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                  Email or phone
                </Label>
                <Input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  placeholder="you@example.com or +254 7XX XXX XXX"
                  className="h-11"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  disabled={busy}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="h-11 w-full" onClick={handleSendOtp} disabled={busy}>
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 text-center">
                <h2 className="text-lg font-semibold">Verify</h2>
                <p className="mt-1 text-xs text-muted-foreground">Enter the code sent to {identifier}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Verification code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  placeholder="••••"
                  className={cn("h-11 text-center text-lg tracking-[0.5em]", error && "border-destructive")}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  disabled={busy}
                />
              </div>

              {needsName && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3"
                >
                  <Label className="flex items-center gap-1 text-xs text-primary">
                    <ShieldCheck className="h-3 w-3" /> Your name (first time here)
                  </Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amina Wanjiru"
                    className="h-11"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  />
                </motion.div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="h-11 w-full"
                onClick={handleVerifyOtp}
                disabled={busy || code.length !== 4 || (needsName && name.length < 2)}
              >
                Verify &amp; log in <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Demo: any 4-digit code works. In production, this is sent via SMS or email.
              </p>
            </>
          )}

          {otpSent && (
            <button onClick={reset} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              ← Use a different email or phone
            </button>
          )}
        </motion.div>

        {/* Trust indicators */}
        <div className="mt-8 w-full max-w-sm space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>New here? You get a KSh 100 welcome travel credit, valid 30 days.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>Fares are held by the platform — never paid to a driver directly.</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>Every action is audit-logged. Sessions expire automatically.</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 text-center text-[10px] text-muted-foreground">Mi-Reli · Mombasa Terminus · Kenya Coast</div>
    </div>
  );
}
