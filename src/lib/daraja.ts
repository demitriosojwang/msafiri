import crypto from "crypto";
import { db } from "@/lib/db";

/**
 * M-Pesa Daraja client — dual mode.
 *
 * RESOLUTION ORDER for credentials: environment variables first, then the
 * credentials saved in Admin → Payments (PlatformConfig). When the four core
 * fields exist (consumer key, consumer secret, shortcode, passkey) the client
 * goes LIVE against Safaricom Daraja; otherwise every call falls through to
 * the deterministic demo simulator, so the whole platform stays demonstrable
 * before real API access arrives.
 *
 * Applying real credentials is therefore zero-code: paste them in the admin
 * console (or set the env vars) and press "Test connection". Nothing else
 * changes — result-code contracts are identical in both modes.
 *
 * Capabilities (same contract in both modes):
 *   - stkPush            → fare collection (Lipa na M-Pesa Online / STK push)
 *   - queryStkResult     → poll the outcome of a push (verify step)
 *   - transactionStatus  → missed-callback recovery sweep
 *   - reversal           → full refunds inside the short window
 *   - b2c                → policy refunds outside the window + driver payouts
 *
 * Environment variables (all optional, override the saved credentials):
 *   MPESA_MODE                force "mock" even when credentials exist
 *   MPESA_ENVIRONMENT         sandbox | production
 *   MPESA_CONSUMER_KEY        Daraja app consumer key
 *   MPESA_CONSUMER_SECRET     Daraja app consumer secret
 *   MPESA_SHORTCODE           collection (head) shortcode — fares land here
 *   MPESA_PASSKEY             Lipa na M-Pesa Online passkey
 *   MPESA_CALLBACK_BASE_URL   public https base, e.g. https://mireli.co.ke
 *   MPESA_B2C_SHORTCODE       initiator shortcode for B2C/reversal (optional)
 *   MPESA_INITIATOR_NAME      API operator username for B2C/reversal
 *   MPESA_INITIATOR_PASSWORD  encrypted with the Safaricom cert at call time
 *   MPESA_SECURITY_CREDENTIAL OR a pre-encrypted security credential
 *   MPESA_CERT                Safaricom public certificate (PEM)
 *
 * Demo-simulator extras (mock mode only):
 *   - Any receiver whose number is in INVALID_B2C_NUMBERS fails B2C with code
 *     "1001" — demonstrates payout-failure handling (flagged, never retried).
 *   - The admin Reconciliation page can inject one refund/payout failure and
 *     a "missed callback" the nightly Transaction Status sweep recovers.
 */

export const RESULT_CODES = {
  SUCCESS: "0",
  CANCELLED: "1032", // Request cancelled by user
  INSUFFICIENT: "1", // Insufficient funds
  INVALID_RECEIVER: "1001", // B2C: invalid/deregistered receiver number
  INVALID_INITIATOR: "2001", // Bad initiator credentials
  TIMEOUT: "1007", // Timeout — cannot be confirmed (also used for network errors)
} as const;

// Drivers whose payout will deliberately fail in demo mode (invalid number demo)
export const INVALID_B2C_NUMBERS = new Set(["+254700000013"]);

// ─── Identifiers (same format in both modes — used by mock + fallbacks) ─────

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

// ─── Demo failure injection (mock mode only) ────────────────────────────────

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

// ─── Credential resolution ───────────────────────────────────────────────────

export interface DarajaCredentials {
  source: "environment" | "database" | "none";
  mode: "mock" | "live";
  environment: string; // sandbox | production
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackBaseUrl: string;
  b2cShortcode: string;
  initiatorName: string;
  initiatorPassword: string;
  securityCredential: string;
  cert: string;
}

function envCredentials(): Partial<DarajaCredentials> {
  const e = process.env;
  return {
    environment: e.MPESA_ENVIRONMENT?.trim() || undefined,
    consumerKey: e.MPESA_CONSUMER_KEY?.trim() || undefined,
    consumerSecret: e.MPESA_CONSUMER_SECRET?.trim() || undefined,
    shortcode: e.MPESA_SHORTCODE?.trim() || undefined,
    passkey: e.MPESA_PASSKEY?.trim() || undefined,
    callbackBaseUrl: e.MPESA_CALLBACK_BASE_URL?.trim() || undefined,
    b2cShortcode: e.MPESA_B2C_SHORTCODE?.trim() || undefined,
    initiatorName: e.MPESA_INITIATOR_NAME?.trim() || undefined,
    initiatorPassword: e.MPESA_INITIATOR_PASSWORD?.trim() || undefined,
    securityCredential: e.MPESA_SECURITY_CREDENTIAL?.trim() || undefined,
    cert: e.MPESA_CERT?.trim() || undefined,
  };
}

/** Resolve credentials: env vars override the admin-saved ones. */
export async function resolveDaraja(): Promise<DarajaCredentials> {
  const cfg = await db.platformConfig.findUnique({ where: { id: "main" } });
  const env = envCredentials();

  const pick = (envVal: string | undefined, dbVal: string | undefined | null) =>
    envVal !== undefined && envVal !== "" ? envVal : dbVal || "";

  const creds: DarajaCredentials = {
    source: env.consumerKey ? "environment" : cfg?.mpesaConsumerKey ? "database" : "none",
    mode: "mock", // final value decided below
    environment: (pick(env.environment, cfg?.mpesaEnvironment) || "sandbox") as string,
    consumerKey: pick(env.consumerKey, cfg?.mpesaConsumerKey),
    consumerSecret: pick(env.consumerSecret, cfg?.mpesaConsumerSecret),
    shortcode: pick(env.shortcode, cfg?.mpesaShortcode),
    passkey: pick(env.passkey, cfg?.mpesaPasskey),
    callbackBaseUrl: pick(env.callbackBaseUrl, cfg?.mpesaCallbackBaseUrl),
    b2cShortcode: pick(env.b2cShortcode, cfg?.mpesaB2CShortcode),
    initiatorName: pick(env.initiatorName, cfg?.mpesaInitiatorName),
    initiatorPassword: pick(env.initiatorPassword, cfg?.mpesaInitiatorPassword),
    securityCredential: pick(env.securityCredential, cfg?.mpesaSecurityCredential),
    cert: pick(env.cert, cfg?.mpesaCert),
  };

  const forcedMock = (process.env.MPESA_MODE || "").trim().toLowerCase() === "mock";
  const complete =
    !!creds.consumerKey && !!creds.consumerSecret && !!creds.shortcode && !!creds.passkey;
  creds.mode = !forcedMock && complete ? "live" : "mock";
  return creds;
}

/** Public pay-side facts for the passenger Pay Sheet. */
export async function getPublicPayOptions(): Promise<{
  paybill: string | null;
  methods: string[];
}> {
  const creds = await resolveDaraja();
  return {
    paybill: creds.shortcode || null,
    methods: ["mpesa_stk", ...(creds.shortcode ? ["mpesa_paybill"] : [])],
  };
}

/** Daraja callback endpoints derived from the configured public base URL. */
export function callbackUrls(creds: DarajaCredentials) {
  const base = creds.callbackBaseUrl.replace(/\/+$/, "");
  return {
    base,
    stkResult: `${base}/api/pay/mpesa/callback`,
    stkTimeout: `${base}/api/pay/mpesa/timeout`,
    c2bConfirmation: `${base}/api/pay/mpesa/c2b`,
    b2cResult: `${base}/api/pay/mpesa/b2c/result`,
  };
}

function apiBase(creds: DarajaCredentials): string {
  return creds.environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/** 07XX / 2547XX / +2547XX → 2547XXXXXXXX (Daraja format), null if invalid. */
export function toMpesaMsISDN(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

/** Daraja timestamps are Nairobi time (EAT, UTC+3): YYYYMMDDHHmmss */
function mpesaTimestamp(): string {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}` +
    `${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`
  );
}

function stkPassword(creds: DarajaCredentials, timestamp: string): string {
  return Buffer.from(`${creds.shortcode}${creds.passkey}${timestamp}`).toString("base64");
}

/** Security credential for B2C/Reversal: pre-encrypted, or encrypt the
 *  initiator password with the Safaricom public cert (RSA PKCS#1 v1.5). */
function securityCredential(creds: DarajaCredentials): string | null {
  if (creds.securityCredential) return creds.securityCredential;
  if (creds.initiatorPassword && creds.cert) {
    try {
      const encrypted = crypto.publicEncrypt(
        { key: certsToPemKey(creds.cert), padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(creds.initiatorPassword, "utf8"),
      );
      return encrypted.toString("base64");
    } catch {
      return null;
    }
  }
  return null;
}

/** Safaricom publishes a X.509 CERT; crypto wants a public key — extract it. */
function certsToPemKey(certPem: string): string {
  if (certPem.includes("BEGIN PUBLIC KEY")) return certPem;
  try {
    const x509 = new crypto.X509Certificate(certPem);
    return x509.publicKey.export({ type: "spki", format: "pem" }).toString();
  } catch {
    return certPem; // let publicEncrypt surface the real error
  }
}

// ─── Live HTTP plumbing ──────────────────────────────────────────────────────

interface TokenCache {
  key: string;
  token: string;
  expiresAt: number;
}
const gToken = globalThis as unknown as { __darajaToken?: TokenCache };

async function darajaFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** OAuth access token — cached until ~60s before expiry. Throws on failure. */
export async function getAccessToken(creds: DarajaCredentials): Promise<string> {
  const cacheKey = `${creds.environment}:${creds.consumerKey}`;
  const cached = gToken.__darajaToken;
  if (cached && cached.key === cacheKey && cached.expiresAt > Date.now()) return cached.token;

  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  const res = await darajaFetch(`${apiBase(creds)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daraja OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: string };
  gToken.__darajaToken = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in || "3599", 10) - 60) * 1000,
  };
  return data.access_token;
}

// ─── STK Push (Lipa na M-Pesa Online) ────────────────────────────────────────

export interface StkPushResult {
  ok: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
}

/** Initiates the STK push. Mock: accepted instantly (the Pay Sheet's verify
 *  step simulates the customer). Live: real Daraja request; the customer
 *  answers on their phone and Daraja posts the result to our callback. */
export async function stkPush(phone: string, amount: number, ref: string): Promise<StkPushResult> {
  if (amount <= 0) throw new Error("STK push amount must be positive");
  const creds = await resolveDaraja();

  if (creds.mode === "mock") {
    return {
      ok: true,
      checkoutRequestId: generateCheckoutRequestId(),
      merchantRequestId: generateMerchantRequestId(),
      responseCode: "0",
      responseDescription: `Success. Request accepted for processing — ref ${ref}`,
    };
  }

  const party = toMpesaMsISDN(phone);
  if (!party) {
    return {
      ok: false,
      checkoutRequestId: "",
      merchantRequestId: "",
      responseCode: "400",
      responseDescription: "Invalid M-Pesa number — use 07XX or 2547XX format",
    };
  }
  const urls = callbackUrls(creds);
  if (!urls.base) {
    return {
      ok: false,
      checkoutRequestId: "",
      merchantRequestId: "",
      responseCode: "400",
      responseDescription: "Callback base URL is not configured — set it in Admin → Payments",
    };
  }
  const timestamp = mpesaTimestamp();
  try {
    const token = await getAccessToken(creds);
    const res = await darajaFetch(`${apiBase(creds)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: creds.shortcode,
        Password: stkPassword(creds, timestamp),
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: party,
        PartyB: creds.shortcode,
        PhoneNumber: party,
        CallBackURL: urls.stkResult,
        AccountReference: ref.slice(0, 12),
        TransactionDesc: `Mi-Reli fare ${ref}`.slice(0, 20),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
    };
    if (data.ResponseCode === "0" && data.CheckoutRequestID) {
      return {
        ok: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID || "",
        responseCode: "0",
        responseDescription: data.ResponseDescription || "Success. Request accepted for processing",
      };
    }
    return {
      ok: false,
      checkoutRequestId: "",
      merchantRequestId: "",
      responseCode: data.ResponseCode || String(res.status),
      responseDescription: data.errorMessage || data.ResponseDescription || "STK push rejected by Daraja",
    };
  } catch (e) {
    return {
      ok: false,
      checkoutRequestId: "",
      merchantRequestId: "",
      responseCode: RESULT_CODES.TIMEOUT,
      responseDescription: `Could not reach Daraja: ${e instanceof Error ? e.message : "network error"}`,
    };
  }
}

export interface StkQueryResult {
  resultCode: string;
  resultDesc: string;
  mpesaReceipt?: string;
  /** True when Daraja has no terminal result yet (still processing / unknown) —
   *  callers must NOT mark the transaction failed in this case. */
  pending?: boolean;
}

function extractReceipt(items: { Name: string; Value?: unknown }[] | undefined): string | undefined {
  const hit = items?.find((i) => i.Name === "MpesaReceiptNumber");
  return typeof hit?.Value === "string" ? hit.Value : undefined;
}

/** Poll the outcome of an STK push.
 *  Mock: always succeeds (the demo "verify" tap = the customer's PIN).
 *  Live: real stkpushquery — pending while the customer hasn't acted. */
export async function queryStkResult(checkoutRequestId: string): Promise<StkQueryResult> {
  const creds = await resolveDaraja();
  if (creds.mode === "mock") {
    return {
      resultCode: RESULT_CODES.SUCCESS,
      resultDesc: "The service request is processed successfully.",
      mpesaReceipt: generateMpesaReceipt(),
    };
  }
  const timestamp = mpesaTimestamp();
  try {
    const token = await getAccessToken(creds);
    const res = await darajaFetch(`${apiBase(creds)}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: creds.shortcode,
        Password: stkPassword(creds, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ResultCode?: string;
      ResultDesc?: string;
      errorMessage?: string;
      errorCode?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: unknown }[] };
    };
    if (typeof data.ResultCode === "string") {
      return {
        resultCode: data.ResultCode,
        resultDesc: data.ResultDesc || "Query result",
        mpesaReceipt:
          data.ResultCode === RESULT_CODES.SUCCESS
            ? extractReceipt(data.CallbackMetadata?.Item)
            : undefined,
      };
    }
    // No terminal result yet — the customer hasn't answered (or ID unknown yet)
    return {
      resultCode: "",
      resultDesc: data.errorMessage || data.errorCode || "Still processing — try again shortly",
      pending: true,
    };
  } catch (e) {
    return {
      resultCode: "",
      resultDesc: `Could not reach Daraja: ${e instanceof Error ? e.message : "network error"}`,
      pending: true,
    };
  }
}

// ─── Transaction Status (missed-callback recovery) ───────────────────────────

/** Resolve an ambiguous payment. ws_CO_* ids are polled via stkpushquery;
 *  M-Pesa receipts go through the Transaction Status endpoint.
 *  Mock: always resolves as paid — the demo point is that the sweep recovers
 *  what a lost webhook would have dropped. */
export async function transactionStatus(
  transactionId: string,
): Promise<StkQueryResult> {
  const creds = await resolveDaraja();
  if (creds.mode === "mock") {
    return {
      resultCode: RESULT_CODES.SUCCESS,
      resultDesc: `Transaction completed successfully (recovered via status query for ${transactionId})`,
      mpesaReceipt: generateMpesaReceipt(),
    };
  }
  if (transactionId.startsWith("ws_CO_")) return queryStkResult(transactionId);

  const initiator = securityCredential(creds);
  if (!creds.initiatorName || !initiator) {
    return {
      resultCode: RESULT_CODES.INVALID_INITIATOR,
      resultDesc: "Transaction Status needs the B2C initiator name + security credential (Admin → Payments)",
    };
  }
  const urls = callbackUrls(creds);
  try {
    const token = await getAccessToken(creds);
    const res = await darajaFetch(`${apiBase(creds)}/mpesa/transactionstatus/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Initiator: creds.initiatorName,
        SecurityCredential: initiator,
        CommandID: "TransactionStatusQuery",
        TransactionID: transactionId,
        PartyA: creds.b2cShortcode || creds.shortcode,
        IdentifierType: "4",
        ResultURL: urls.b2cResult,
        QueueTimeOutURL: urls.stkTimeout,
        Remarks: "Mi-Reli reconciliation sweep",
        Occasion: "reconciliation",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };
    if (data.ResponseCode === "0") {
      // Accepted — the authoritative result lands on the b2c result webhook.
      return {
        resultCode: "",
        resultDesc: "Status query accepted — result will arrive on the webhook",
        pending: true,
      };
    }
    return {
      resultCode: data.ResponseCode || RESULT_CODES.TIMEOUT,
      resultDesc: data.errorMessage || data.ResponseDescription || "Status query rejected",
    };
  } catch (e) {
    return {
      resultCode: "",
      resultDesc: `Could not reach Daraja: ${e instanceof Error ? e.message : "network error"}`,
      pending: true,
    };
  }
}

// ─── Reversal (full refund, short window) ────────────────────────────────────

export interface DarajaResultCode {
  resultCode: string;
  resultDesc: string;
}

export async function reversal(params: {
  transactionId: string; // original M-Pesa receipt
  amount: number;
}): Promise<DarajaResultCode> {
  const creds = await resolveDaraja();
  if (creds.mode === "mock") {
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

  const initiator = securityCredential(creds);
  if (!creds.initiatorName || !initiator) {
    return {
      resultCode: RESULT_CODES.INVALID_INITIATOR,
      resultDesc: "Reversal needs the B2C initiator name + security credential (Admin → Payments)",
    };
  }
  const urls = callbackUrls(creds);
  try {
    const token = await getAccessToken(creds);
    const res = await darajaFetch(`${apiBase(creds)}/mpesa/reversal/v1/request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Initiator: creds.initiatorName,
        SecurityCredential: initiator,
        CommandID: "TransactionReversal",
        TransactionID: params.transactionId,
        Amount: Math.round(params.amount),
        ReceiverParty: creds.b2cShortcode || creds.shortcode,
        RecieverIdentifierType: "11", // Safaricom's spelling — do not "fix"
        ResultURL: urls.b2cResult,
        QueueTimeOutURL: urls.stkTimeout,
        Remarks: "Mi-Reli refund",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };
    if (data.ResponseCode === "0") {
      return {
        resultCode: RESULT_CODES.SUCCESS,
        resultDesc: data.ResponseDescription || "Reversal accepted",
      };
    }
    return {
      resultCode: data.ResponseCode || RESULT_CODES.TIMEOUT,
      resultDesc: data.errorMessage || data.ResponseDescription || "Reversal rejected",
    };
  } catch (e) {
    return {
      resultCode: RESULT_CODES.TIMEOUT,
      resultDesc: `Could not reach Daraja: ${e instanceof Error ? e.message : "network error"}`,
    };
  }
}

// ─── B2C (policy refunds outside the window + driver payouts) ────────────────

export async function b2c(params: {
  receiverPhone: string;
  amount: number;
  remarks?: string;
}): Promise<DarajaResultCode> {
  const creds = await resolveDaraja();
  if (creds.mode === "mock") {
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

  const party = toMpesaMsISDN(params.receiverPhone);
  if (!party) {
    return {
      resultCode: RESULT_CODES.INVALID_RECEIVER,
      resultDesc: `B2C rejected: receiver ${params.receiverPhone} is not a valid Safaricom number`,
    };
  }
  const initiator = securityCredential(creds);
  if (!creds.initiatorName || !initiator) {
    return {
      resultCode: RESULT_CODES.INVALID_INITIATOR,
      resultDesc: "B2C needs the initiator name + security credential (Admin → Payments)",
    };
  }
  const urls = callbackUrls(creds);
  try {
    const token = await getAccessToken(creds);
    const res = await darajaFetch(`${apiBase(creds)}/mpesa/b2c/v3/paymentrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        OriginatorConversationID: `MR-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
        InitiatorName: creds.initiatorName,
        SecurityCredential: initiator,
        CommandID: "BusinessPayment",
        Amount: Math.round(params.amount),
        PartyA: creds.b2cShortcode || creds.shortcode,
        PartyB: party,
        Remarks: (params.remarks || "Mi-Reli payout").slice(0, 100),
        QueueTimeOutURL: urls.stkTimeout,
        ResultURL: urls.b2cResult,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };
    if (data.ResponseCode === "0") {
      return {
        resultCode: RESULT_CODES.SUCCESS,
        resultDesc: data.ResponseDescription || "B2C accepted",
      };
    }
    return {
      resultCode: data.ResponseCode || RESULT_CODES.TIMEOUT,
      resultDesc: data.errorMessage || data.ResponseDescription || "B2C rejected",
    };
  } catch (e) {
    return {
      resultCode: RESULT_CODES.TIMEOUT,
      resultDesc: `Could not reach Daraja: ${e instanceof Error ? e.message : "network error"}`,
    };
  }
}

// ─── Admin connection test ───────────────────────────────────────────────────

export async function testConnection(): Promise<{ ok: boolean; message: string; mode: string }> {
  const creds = await resolveDaraja();
  if (creds.mode === "mock") {
    const missing = [
      !creds.consumerKey && "Consumer Key",
      !creds.consumerSecret && "Consumer Secret",
      !creds.shortcode && "Shortcode (Paybill)",
      !creds.passkey && "Passkey",
    ].filter(Boolean) as string[];
    return {
      ok: false,
      mode: "mock",
      message: missing.length
        ? `Still in demo simulation — missing: ${missing.join(", ")}. Save the credentials, then test again.`
        : "Forced to demo simulation by MPESA_MODE=mock.",
    };
  }
  try {
    const token = await getAccessToken(creds);
    const urls = callbackUrls(creds);
    const warnings: string[] = [];
    if (!urls.base) warnings.push("no callback base URL set (STK push results would be lost — set it before going live)");
    if (!creds.initiatorName || !securityCredential(creds)) warnings.push("B2C/Reversal initiator not configured (payouts and cash refunds would fail)");
    return {
      ok: true,
      mode: creds.mode,
      message:
        `OAuth OK — token acquired from ${creds.environment} (${token.slice(0, 6)}…). ` +
        (warnings.length ? `Note: ${warnings.join("; ")}.` : "Callbacks and initiator are configured."),
    };
  } catch (e) {
    return {
      ok: false,
      mode: creds.mode,
      message: `Connection failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}
