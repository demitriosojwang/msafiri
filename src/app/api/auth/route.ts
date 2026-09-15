import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  encodeSession,
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

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
