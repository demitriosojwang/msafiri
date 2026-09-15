"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client";
import { ArrowLeft, KeyRound, Loader2, MailCheck, ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [twofa, setTwofa] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? straight to the console.
  useEffect(() => {
    api("/api/admin/overview").then(() => router.replace("/admin")).catch(() => {});
  }, []);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/auth", { body: { step: "request", email } });
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access denied");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/auth", { body: { step: "verify", email, code, twofa } });
      router.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access denied");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-primary px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Logo size="lg" />
          <CardTitle className="mt-2">Ops console</CardTitle>
          <CardDescription>Restricted — oversight access only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="flex items-center gap-1.5">
                  <MailCheck className="h-4 w-4 text-primary" /> Work email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="you@mireli.co.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email && requestOtp()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={requestOtp} disabled={busy || !email}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-otp">Verification code sent to {email}</Label>
                <Input
                  id="admin-otp"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="• • • •"
                  className="text-center text-2xl tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-2fa" className="flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-primary" /> Admin access code (2nd factor)
                </Label>
                <Input
                  id="admin-2fa"
                  type="password"
                  placeholder="Access code"
                  value={twofa}
                  onChange={(e) => setTwofa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={verify} disabled={busy || code.length !== 4 || !twofa}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock console"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep("email")}>
                <ArrowLeft className="h-4 w-4" /> Start over
              </Button>
              <p className="rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                Prototype: any 4-digit code works · access code is set in Config
              </p>
            </>
          )}

          <div className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Admin access is granted by identity, not by a button — non-admin emails are rejected
              here, and every sign-in attempt is audit-logged.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
