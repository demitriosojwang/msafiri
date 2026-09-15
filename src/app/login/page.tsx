"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, useMe } from "@/lib/client";
import { ArrowLeft, Loader2, MessageSquareLock, ShieldCheck } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { refresh } = useMe();

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth", { body: { step: "request", identifier } });
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
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
      await refresh();
      router.push(next === "book" ? "/" : next || "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <Logo size="lg" />
            <CardTitle className="mt-2">Karibu back</CardTitle>
            <CardDescription>
              One login for everyone — your account is recognised automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "identifier" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Phone number or email</Label>
                  <Input
                    id="identifier"
                    placeholder="07XX XXX XXX or you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && identifier && requestOtp()}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" onClick={requestOtp} disabled={busy || !identifier}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </Button>
              </>
            )}

            {step === "otp" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp" className="flex items-center gap-1.5">
                    <MessageSquareLock className="h-4 w-4 text-primary" />
                    Verification code sent to {identifier}
                  </Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="• • • •"
                    className="text-center text-2xl tracking-[0.5em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && code.length === 4 && verify()}
                  />
                </div>
                {needsName && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name (first time here)</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Amina Wanjiru"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" onClick={verify} disabled={busy || code.length !== 4 || (needsName && name.length < 2)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => { setStep("identifier"); setNeedsName(false); }}>
                  <ArrowLeft className="h-4 w-4" /> Use a different number
                </Button>
                <p className="rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                  Prototype: any 4-digit code works.
                </p>
              </>
            )}

            <div className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Failed logins are rate-limited, sessions expire automatically, and every action is
                audit-logged. Admin access is granted by identity — never by a button.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
