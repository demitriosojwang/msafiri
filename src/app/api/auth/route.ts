import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  encodeSession,
  getPassengerSession,
  isGuestPassenger,
  normalizePhone,
  passengerCookieOptions,
  adminCookieOptions,
} from "@/lib/session";
import { getConfig, issueCredit } from "@/lib/money";
import { audit } from "@/lib/audit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENDERS = ["Male", "Female", "Other"];

/**
 * Identity auth — one details form is both sign-up and sign-in:
 *  - a phone that has never booked/signed up creates the account (in place of
 *    the current guest session, so bookings and credits carry over);
 *  - a phone that already belongs to an account signs straight back in and
 *    any blank profile fields are filled from the form.
 * No passwords in the prototype — the details themselves are the identity.
 * Admin stays identity-gated at /admin (separate /api/admin/auth route).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const step = body.step as string;

  if (step === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...passengerCookieOptions(), value: "" });
    res.cookies.set({ ...adminCookieOptions(), value: "" });
    return res;
  }

  if (step === "identity") {
    const fullName = String(body.fullName || "").trim();
    const idNumber = String(body.idNumber || "").trim();
    const nationality = String(body.nationality || "").trim();
    const gender = String(body.gender || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phoneNorm = normalizePhone(String(body.phone || ""));

    // ── Validate everything up front — clean 400s, never a 500 ──────────────
    if (fullName.length < 2) {
      return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    }
    if (idNumber.length < 4) {
      return NextResponse.json({ error: "Enter a valid ID/Passport number" }, { status: 400 });
    }
    if (nationality.length < 3) {
      return NextResponse.json({ error: "Enter your nationality" }, { status: 400 });
    }
    if (!GENDERS.includes(gender)) {
      return NextResponse.json({ error: "Select your gender" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (!phoneNorm) {
      return NextResponse.json(
        { error: "Enter a valid phone number (07XX XXX XXX or 2547XX XXX XXX)" },
        { status: 400 },
      );
    }

    const cfg = await getConfig();
    const current = await getPassengerSession();
    const me = current ? await db.passenger.findUnique({ where: { id: current.id } }) : null;

    let passenger = await db.passenger.findUnique({ where: { phone: phoneNorm } });
    let isNew = false;

    if (passenger) {
      // Returning account — sign in, filling any profile blanks from the form.
      passenger = await db.passenger.update({
        where: { id: passenger.id },
        data: {
          name: passenger.name || fullName.slice(0, 80),
          email: passenger.email || email,
          idNumber: passenger.idNumber || idNumber,
          nationality: passenger.nationality || nationality,
          gender: passenger.gender || gender,
          isGuest: false,
        },
      });
    } else if (me && isGuestPassenger(me)) {
      // First account for this device — promote the guest session in place so
      // existing bookings, credits and history all carry over untouched.
      isNew = true;
      passenger = await db.passenger.update({
        where: { id: me.id },
        data: {
          phone: phoneNorm,
          name: fullName.slice(0, 80),
          email,
          idNumber,
          nationality,
          gender,
          isGuest: false,
        },
      });
    } else {
      // No session (or an already-real session booking for a new phone).
      isNew = true;
      passenger = await db.passenger.create({
        data: {
          phone: phoneNorm,
          name: fullName.slice(0, 80),
          email,
          idNumber,
          nationality,
          gender,
        },
      });
      // Karibu — welcome credit (30-day validity per config). Guests that were
      // promoted in place already hold theirs, so only brand-new rows get one.
      await issueCredit({
        passengerId: passenger.id,
        amount: 100,
        note: "Karibu Mi-Reli! Welcome credit — applies to any ride.",
        validityDays: cfg.creditValidityDays,
      });
    }

    const session = {
      role: "passenger" as const,
      id: passenger.id,
      name: passenger.name || "Passenger",
      identifier: passenger.phone,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const res = NextResponse.json({ ok: true, isNew, session });
    res.cookies.set({ ...passengerCookieOptions(), value: encodeSession(session) });
    await audit({
      actorId: passenger.id,
      actorName: passenger.name || phoneNorm,
      actorRole: "passenger",
      action: isNew ? "auth.signup" : "auth.login",
      entity: "passenger",
      entityId: passenger.id,
      metadata: { phone: phoneNorm, email, promotedGuest: Boolean(me && isGuestPassenger(me)) },
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
