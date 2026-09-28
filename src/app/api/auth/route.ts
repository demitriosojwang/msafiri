import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  encodeSession,
  getPassengerSession,
  isAdminEmail,
  normalizePhone,
  passengerCookieOptions,
  adminCookieOptions,
} from "@/lib/session";
import { getConfig, issueCredit } from "@/lib/money";
import { audit } from "@/lib/audit";

/**
 * Unified auth — one entry point, roles detected by identity:
 *  - passengers log in with phone (any 4-digit OTP in the prototype)
 *  - admin identity is recognised by email whitelist (never by a visible button)
 *    and requires a second factor (2FA code) — enforced ONLY on /admin.
 * The main passenger site never grants admin; /admin/login is a separate URL.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const step = body.step as string;
  const cfg = await getConfig();
  const adminEmails = JSON.parse(cfg.adminEmails) as string[];

  if (step === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...passengerCookieOptions(), value: "" });
    res.cookies.set({ ...adminCookieOptions(), value: "" });
    return res;
  }

  if (step === "request") {
    const identifier = String(body.identifier || "").trim();
    if (!identifier) return NextResponse.json({ error: "Enter your phone number or email" }, { status: 400 });
    const phone = normalizePhone(identifier);
    const email = phone ? null : identifier.toLowerCase();
    if (!phone && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) {
      return NextResponse.json({ error: "Enter a valid phone number or email" }, { status: 400 });
    }
    // Anti-enumeration: always the same "OTP sent" response shape.
    return NextResponse.json({
      ok: true,
      identifier: phone || email,
      method: phone ? "phone" : "email",
      hint: "Prototype: any 4-digit code works",
    });
  }

  if (step === "verify") {
    const identifier = String(body.identifier || "").trim();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 4-digit code" }, { status: 400 });
    }

    const phone = normalizePhone(identifier);
    const email = phone ? null : identifier.toLowerCase();

    if (phone) {
      let passenger = await db.passenger.findUnique({ where: { phone } });
      let isNew = false;
      if (!passenger) {
        if (!name || name.length < 2) {
          return NextResponse.json({ needsName: true, identifier: phone }, { status: 200 });
        }
        isNew = true;
        passenger = await db.passenger.create({
          data: { phone, name: name.slice(0, 80) },
        });
        // Karibu — welcome credit (30-day validity per config)
        await issueCredit({
          passengerId: passenger.id,
          amount: 100,
          note: "Karibu Mi-Reli! Welcome credit — applies to any ride.",
          validityDays: cfg.creditValidityDays,
        });
        await audit({
          actorId: passenger.id,
          actorName: passenger.name || phone,
          actorRole: "passenger",
          action: "auth.signup",
          entity: "passenger",
          entityId: passenger.id,
          metadata: { welcomeCredit: 100 },
        });
      }
      const session = {
        role: "passenger" as const,
        id: passenger.id,
        name: passenger.name || "Passenger",
        identifier: passenger.phone,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      const res = NextResponse.json({ ok: true, session, isNew });
      res.cookies.set({ ...passengerCookieOptions(), value: encodeSession(session) });
      await audit({
        actorId: passenger.id,
        actorName: passenger.name || phone,
        actorRole: "passenger",
        action: "auth.login",
        entity: "passenger",
        entityId: passenger.id,
      });
      return res;
    }

    if (email) {
      // Non-admin email login (e.g. someone booking from a laptop) — passenger session by email.
      let passenger = await db.passenger.findFirst({ where: { email } });
      if (!passenger) {
        if (!name || name.length < 2) {
          return NextResponse.json({ needsName: true, identifier: email }, { status: 200 });
        }
        passenger = await db.passenger.create({ data: { email, name: name.slice(0, 80), phone: `email-${email}` } });
      }
      const session = {
        role: "passenger" as const,
        id: passenger.id,
        name: passenger.name || "Passenger",
        identifier: email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      const res = NextResponse.json({ ok: true, session });
      res.cookies.set({ ...passengerCookieOptions(), value: encodeSession(session) });
      return res;
    }

    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }

  if (step === "signup") {
    // Account creation from the booking flow. The rule: to book more than the
    // single no-login seat, the passenger fills the EXACT same details they
    // booked with — the platform then upgrades the guest into a Mi-Reli
    // account (or claims an existing account that matches those details).
    const code = String(body.code || "").trim();
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 4-digit code" }, { status: 400 });
    }

    const fullName = String(body.name || "").trim();
    if (fullName.length < 2 || !fullName.includes(" ")) {
      return NextResponse.json(
        { error: "Enter your full name (first and last name)" },
        { status: 400 },
      );
    }
    const phone = normalizePhone(String(body.phone || ""));
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid phone number (07XX XXX XXX or 2547XX XXX XXX)" }, { status: 400 });
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    const idType = body.idType === "passport" ? "passport" : "id";
    const idNumber = String(body.idNumber || "").trim();
    if (idNumber.length < 4) {
      return NextResponse.json({ error: `Enter a valid ${idType === "passport" ? "passport number" : "ID number"}` }, { status: 400 });
    }
    const nationality = String(body.nationality || "").trim();
    if (!nationality) return NextResponse.json({ error: "Select your nationality" }, { status: 400 });
    const gender = String(body.gender || "").trim().toLowerCase();
    if (!gender) return NextResponse.json({ error: "Select your gender" }, { status: 400 });

    const session = await getPassengerSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired — refresh and try again" }, { status: 401 });
    }
    const current = await db.passenger.findUnique({ where: { id: session.id } });
    if (!current) {
      return NextResponse.json({ error: "Session expired — refresh and try again" }, { status: 401 });
    }
    if (!current.phone.startsWith("guest-")) {
      return NextResponse.json(
        { error: "You already have a Mi-Reli account. Log out first to sign up with different details." },
        { status: 409 },
      );
    }

    const profile = { name: fullName.slice(0, 80), email, idType, idNumber, nationality: nationality.slice(0, 60), gender };
    const sameDetails = (a: string | null | undefined, b: string) =>
      (a || "").trim().toLowerCase() === b.trim().toLowerCase();

    // Does the phone already belong to a real account?
    const existing = phone === current.phone ? null : await db.passenger.findUnique({ where: { phone } });

    if (existing) {
      // Claim only when the details match EXACTLY — that is the platform's
      // identity check ("fill the exact same details").
      const matches =
        sameDetails(existing.name, fullName) &&
        sameDetails(existing.email, email) &&
        sameDetails(existing.idNumber, idNumber) &&
        sameDetails(existing.nationality, nationality) &&
        sameDetails(existing.gender, gender);
      if (!matches) {
        return NextResponse.json(
          { error: "An account with this phone already exists. Fill the exact same details you booked with, or login instead." },
          { status: 409 },
        );
      }
      // Move the guest's bookings + credits onto the claimed account, then
      // retire the guest row.
      await db.booking.updateMany({ where: { passengerId: current.id }, data: { passengerId: existing.id } });
      await db.credit.updateMany({ where: { passengerId: current.id }, data: { passengerId: existing.id } });
      await db.passenger.delete({ where: { id: current.id } });
      await db.passenger.update({
        where: { id: existing.id },
        data: {
          email: existing.email || email,
          idType: existing.idType || idType,
          idNumber: existing.idNumber || idNumber,
          nationality: existing.nationality || nationality,
          gender: existing.gender || gender,
        },
      });
      const newSession = {
        role: "passenger" as const,
        id: existing.id,
        name: existing.name || fullName,
        identifier: existing.phone,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      const res = NextResponse.json({ ok: true, claimed: true });
      res.cookies.set({ ...passengerCookieOptions(), value: encodeSession(newSession) });
      await audit({
        actorId: existing.id,
        actorName: existing.name || phone,
        actorRole: "passenger",
        action: "auth.claim",
        entity: "passenger",
        entityId: existing.id,
        metadata: { matchedBy: "exact_details", guestId: current.id },
      });
      return res;
    }

    // Fresh account — upgrade the guest row in place so their first booking,
    // credit and session continuity carry over.
    const updated = await db.passenger.update({ where: { id: current.id }, data: { phone, ...profile } });
    const newSession = {
      role: "passenger" as const,
      id: updated.id,
      name: updated.name || "Passenger",
      identifier: updated.phone,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const res = NextResponse.json({ ok: true, claimed: false });
    res.cookies.set({ ...passengerCookieOptions(), value: encodeSession(newSession) });
    await audit({
      actorId: updated.id,
      actorName: updated.name || phone,
      actorRole: "passenger",
      action: "auth.signup",
      entity: "passenger",
      entityId: updated.id,
      metadata: { upgradedFromGuest: true, nationality, gender },
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
