import crypto from "crypto";

/**
 * Daraja (M-Pesa) simulator.
 *
 * Mirrors the four Safaricom Daraja capabilities the platform needs:
 *   - STK Push (Lipa na M-Pesa Online)   → fare collection
 *   - Reversal                           → full refunds inside the short window
 *   - B2C                                → policy-based refunds + driver payouts
 *   - Transaction Status                 → missed-callback recovery sweep
 *
 * In production each function below is replaced by a real HTTPS call to
 * api.safaricom.co.ke with OAuth tokens + security credential encryption.
 * The result-code contract is kept identical so only this file changes.
 *
 * For the prototype everything is deterministic so every money path can be
 * demonstrated on demand:
 *   - Any driver whose mpesaNumber is in INVALID_B2C_NUMBERS fails B2C with
 *     result code "1001" (invalid receiver) — used to demo payout failure
 *     handling (flagged for admin, never silently retried).
 *   - The admin Reconciliation page can inject a "missed callback" that the
 *     nightly Transaction Status sweep then recovers.
 */

export const RESULT_CODES = {
  SUCCESS: "0",
  CANCELLED: "1032", // Request cancelled by user
  INSUFFICIENT: "1", // Insufficient funds
  INVALID_RECEIVER: "1001", // B2C: invalid/deregistered receiver number
  INVALID_INITIATOR: "2001", // Bad initiator credentials
  TIMEOUT: "1007", // Timeout — cannot be confirmed
} as const;

// Drivers whose payout will deliberately fail (invalid/deregistered number demo)
export const INVALID_B2C_NUMBERS = new Set(["+254700000013"]);

interface DarajaState {
  injectNextRefundFailure: boolean;
  injectNextPayoutFailure: boolean;
}

const g = globalThis as unknown as { __darajaState?: DarajaState };
if (!g.__darajaState) {
  g.__darajaState = {
    injectNextRefundFailure: false,
    injectNextPayoutFailure: false,
  };
}
const state = g.__darajaState;

export function setRefundFailureInjection(on: boolean) {
  state.injectNextRefundFailure = on;
}
export function setPayoutFailureInjection(on: boolean) {
  state.injectNextPayoutFailure = on;
}

// ─── Identifiers ─────────────────────────────────────────────────────────────

export function generateCheckoutRequestId(): string {
  return `ws_CO_${Date.now()}${crypto.randomInt(100, 999)}`;
}
export function generateMerchantRequestId(): string {
  return `${Date.now()}-${crypto.randomInt(1000, 9999)}`;
}
// Real M-Pesa receipts look like "SJK41S7Y8D" (10 chars, uppercase alnum)
export function generateMpesaReceipt(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[crypto.randomInt(chars.length)];
  return s;
}
export function generateBookingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[crypto.randomInt(chars.length)];
  return `MR-${s}`;
}

// ─── STK Push (Lipa na M-Pesa Online) ────────────────────────────────────────

export interface StkPushResult {
  ok: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
}

/** Initiates the STK push. In the prototype the "customer" confirms via the
 *  Pay Sheet's verify step (see confirmStkCallback). */
export function stkPush(phone: string, amount: number, ref: string): StkPushResult {
  if (amount <= 0) {
    throw new Error("STK push amount must be positive");
  }
  return {
    ok: true,
    checkoutRequestId: generateCheckoutRequestId(),
    merchantRequestId: generateMerchantRequestId(),
    responseCode: "0",
    responseDescription: `Success. Request accepted for processing — ref ${ref}`,
  };
}

/** Simulates the result callback the platform receives after the customer
 *  acts on the prompt (or the merchant hits "verify" in the prototype). */
export function confirmStkCallback(): {
  resultCode: string;
  resultDesc: string;
  mpesaReceipt: string;
} {
  return {
    resultCode: RESULT_CODES.SUCCESS,
    resultDesc: "The service request is processed successfully.",
    mpesaReceipt: generateMpesaReceipt(),
  };
}

// ─── Transaction Status (missed-callback recovery) ───────────────────────────

export function transactionStatus(checkoutRequestId: string): {
  resultCode: string;
  resultDesc: string;
  mpesaReceipt?: string;
} {
  // In the sandbox every "ambiguous" payment resolves as paid — the demo point
  // is that the sweep recovers what a missed webhook would have lost.
  return {
    resultCode: RESULT_CODES.SUCCESS,
    resultDesc: `Transaction completed successfully (recovered via status query for ${checkoutRequestId})`,
    mpesaReceipt: generateMpesaReceipt(),
  };
}

// ─── Reversal (full refund, short window) ────────────────────────────────────

export function reversal(params: {
  transactionId: string; // original M-Pesa receipt
  amount: number;
}): { resultCode: string; resultDesc: string } {
  if (state.injectNextRefundFailure) {
    state.injectNextRefundFailure = false;
    return {
      resultCode: RESULT_CODES.INVALID_INITIATOR,
      resultDesc: "Reversal rejected: invalid initiator credentials (simulated failure)",
    };
  }
  return {
    resultCode: RESULT_CODES.SUCCESS,
    resultDesc: `Reversal of KSh ${params.amount} on ${params.transactionId} accepted`,
  };
}

// ─── B2C (policy refunds outside the window + driver payouts) ────────────────

export function b2c(params: {
  receiverPhone: string;
  amount: number;
}): { resultCode: string; resultDesc: string } {
  if (state.injectNextPayoutFailure) {
    state.injectNextPayoutFailure = false;
    return {
      resultCode: RESULT_CODES.INVALID_RECEIVER,
      resultDesc: "B2C rejected: invalid receiver number (simulated failure)",
    };
  }
  if (INVALID_B2C_NUMBERS.has(params.receiverPhone)) {
    return {
      resultCode: RESULT_CODES.INVALID_RECEIVER,
      resultDesc: `B2C rejected: receiver ${params.receiverPhone} is invalid or deregistered`,
    };
  }
  return {
    resultCode: RESULT_CODES.SUCCESS,
    resultDesc: `B2C of KSh ${params.amount} to ${params.receiverPhone} accepted`,
  };
}
