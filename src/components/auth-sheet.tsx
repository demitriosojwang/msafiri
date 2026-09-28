"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, detailsComplete, type PassengerDetails } from "@/lib/client";
import { NATIONALITY_GROUPS, DEFAULT_NATIONALITY } from "@/lib/nationalities";
import { ArrowRight, Loader2, ShieldCheck, UserRoundCheck } from "lucide-react";

/**
 * Create / claim a Mi-Reli account from the booking flow.
 * The rule: passengers fill the EXACT same details they booked with —
 * the server matches them (phone + name + ID + email) and upgrades the
 * guest into an account, carrying over bookings and travel credit.
 */
export function AuthSheet({
  open,
  onClose,
  initialDetails,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  initialDetails: PassengerDetails;
  onAuthed: () => void;
}) {
  const [step, setStep] = useState<"details" | "verify">("details");
  const [details, setDetails] = useState<PassengerDetails>(initialDetails);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("details");
      setCode("");
      setError(null);
      setDetails({ ...initialDetails, nationality: initialDetails.nationality || DEFAULT_NATIONALITY });
    }
  }, [open, initialDetails]);

  function set<K extends keyof PassengerDetails>(key: K, value: PassengerDetails[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  async function submit() {
    if (!detailsComplete(details) || code.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth", {
        body: {
          step: "signup",
          code,
          name: details.fullName.trim(),
          phone: details.phone,
          email: details.email.trim(),
          idType: details.idType,
          idNumber: details.idNumber.trim(),
          nationality: details.nationality,
          gender: details.gender,
        },
      });
      onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <UserRoundCheck className="h-5 w-5 text-primary" />
            {step === "details" ? "Your Mi-Reli account" : "Verify your number"}
          </SheetTitle>
          <SheetDescription>
            {step === "details"
              ? "Fill the exact same details you booked with — your rides and travel credit carry over to your account."
              : `We send a 4-digit code to ${details.phone}. Enter it to finish creating your account.`}
          </SheetDescription>
        </SheetHeader>

        {step === "details" ? (
          <div className="space-y-4 px-4 pb-2">
            <div className="space-y-3 rounded-lg border bg-card p-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Personal details</Label>
              <Input
                value={details.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Full name (as on your ID)"
                className="h-10"
                autoComplete="name"
              />
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Select value={details.idType} onValueChange={(v) => set("idType", v as PassengerDetails["idType"])}>
                  <SelectTrigger className="h-10 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">National ID</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={details.idNumber}
                  onChange={(e) => set("idNumber", e.target.value)}
                  placeholder={details.idType === "passport" ? "Passport number" : "ID number"}
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Nationality</Label>
                  <Select value={details.nationality || DEFAULT_NATIONALITY} onValueChange={(v) => set("nationality", v)}>
                    <SelectTrigger className="h-10 w-full text-xs">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {NATIONALITY_GROUPS.map((g) => (
                        <SelectGroup key={g.group}>
                          <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.group}</SelectLabel>
                          {g.options.map((n) => (
                            <SelectItem key={n} value={n} className="text-xs">
                              {n}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Gender</Label>
                  <Select value={details.gender || undefined} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger className="h-10 w-full text-xs">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female" className="text-xs">Female</SelectItem>
                      <SelectItem value="male" className="text-xs">Male</SelectItem>
                      <SelectItem value="other" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact info</Label>
              <Input
                type="email"
                value={details.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Email address"
                className="h-10"
                autoComplete="email"
              />
              <Input
                value={details.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="M-Pesa number · 07XX XXX XXX"
                inputMode="tel"
                className="h-10"
                autoComplete="tel"
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                Your details must match your first booking exactly — that is how Mi-Reli knows the rides already on your phone belong to you.
              </span>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-2">
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
                className="h-11 text-center text-lg tracking-[0.5em]"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submit()}
                disabled={busy}
              />
              <p className="text-[10px] text-muted-foreground">Demo: any 4-digit code works. In production this is sent via SMS.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              onClick={() => {
                setStep("details");
                setError(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Change your details
            </button>
          </div>
        )}

        <SheetFooter className="px-4 pb-4">
          {step === "details" ? (
            <Button
              className="h-11 w-full"
              disabled={busy || !detailsComplete(details)}
              onClick={() => {
                setStep("verify");
                setError(null);
              }}
            >
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button className="h-11 w-full" disabled={busy || code.length !== 4} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account & continue"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
