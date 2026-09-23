import { NextResponse } from "next/server";
import { getPublicPayOptions } from "@/lib/daraja";

/**
 * Public (no session) — tells the Pay Sheet which payment options exist.
 * The Paybill option only appears once the platform's M-Pesa shortcode is
 * configured (env or Admin → Payments); STK push always exists (live or demo).
 */
export async function GET() {
  const options = await getPublicPayOptions();
  return NextResponse.json(options);
}
