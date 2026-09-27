"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, notifyAuthChange, useMe, type PassengerDetails } from "@/lib/client";
import { ArrowRight, BadgeCheck, IdCard, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { LogoTile } from "@/components/site-chrome";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Loose client-side check mirroring the server's normalizePhone. */
function isValidPhone(input: string): boolean {
  const d = input.replace(/\D/g, "");
  return /^(?:254|0)?(?:7|1)\d{8}$/.test(d);
}

/** Details stored on this device prefill the form — the exact same details
 *  used at guest checkout are all it takes to create/sign into an account. */
const DETAILS_KEY = "mireli.guest";

function loadDetails(): Partial<PassengerDetails> & { name?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DETAILS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/**
 * One details form — sign in AND sign up:
 *  - new phone → creates the Mi-Reli account (promoting this device's guest
 *    session in place, so prior bookings and credits carry over);
 *  - known phone → signs straight back in.
 * Filling the exact same details asked at checkout is all the identity the
 * prototype needs. Wired to POST /api/auth { step: "identity" }.
 */
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const { me } = useMe();
  const [details, setDetails] = useState<PassengerDetails>({
    fullName: "",
    idNumber: "",
    nationality: "Kenyan",
    gender: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = loadDetails();
    setDetails((d) => ({
      fullName: d.fullName || stored.fullName || stored.name || "",
      idNumber: d.idNumber || stored.idNumber || "",
      nationality: d.nationality || stored.nationality || "Kenyan",
      gender: d.gender || stored.gender || "",
      email: d.email || stored.email || "",
      phone: d.phone || stored.phone || "",
    }));
  }, []);

  function set<K extends keyof PassengerDetails>(key: K, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  const valid =
    details.fullName.trim().length >= 2 &&
    details.idNumber.trim().length >= 4 &&
    details.nationality.trim().length >= 3 &&
    ["Male", "Female", "Other"].includes(details.gender) &&
    EMAIL_RE.test(details.email.trim()) &&
    isValidPhone(details.phone);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth", {
        body: { step: "identity", ...details, fullName: details.fullName.trim() },
      });
      try {
        window.localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
      } catch {}
      notifyAuthChange();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const signedIn = !!me?.session && me.passenger?.isGuest === false;

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
        <p className="mb-6 text-sm text-muted-foreground">Ride · Connect · Journey</p>

        {signedIn && (
          <div className="mb-4 flex w-full max-w-sm items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              You&apos;re signed in as <b>{me?.session?.name}</b>. Filling this form with the same
              details keeps you on the same account.
            </span>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-4">
          <div className="mb-2 text-center">
            <h2 className="text-lg font-semibold">Sign in or create your account</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One form for both — use the exact same details you book with.
            </p>
          </div>

          {/* Personal Details */}
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <UserRound className="h-3 w-3" /> Personal Details
            </Label>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={details.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Full Name"
                className="h-10"
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                <IdCard className="h-3 w-3" /> ID/Passport Number
              </Label>
              <Input
                value={details.idNumber}
                onChange={(e) => set("idNumber", e.target.value)}
                placeholder="e.g. 12345678 or A1234567"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nationality</Label>
                <Input
                  value={details.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                  placeholder="Kenyan"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Gender</Label>
                <Select value={details.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3 w-3" /> Contact Info
            </Label>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={details.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
                className="h-10"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> Phone Number
              </Label>
              <Input
                type="tel"
                value={details.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="07XX XXX XXX"
                className="h-10"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="h-11 w-full" onClick={submit} disabled={busy || !valid}>
            {busy ? "Please wait…" : "Continue"} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            Your phone number identifies your account — bookings made with it show up here.
          </p>
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
