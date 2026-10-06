/** Browser protections complement escaped React output and parameterized Prisma queries. */
export function contentSecurityPolicy(nonce: string, development: boolean) {
  if (!/^[A-Za-z0-9+/_=-]{20,100}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Radix, motion and charts use inline style attributes; scripts never get unsafe-inline.
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
    "font-src 'self' data:", `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    "frame-src 'none'",
  ].join("; ");
}

export function rejectBrowserMutation(request: Request, trustedOrigin: string | undefined): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  const cookie = request.headers.get("cookie") || "";
  const cookieSession = /(?:^|;\s*)(?:mireli_session|mireli_admin)=/.test(cookie);
  if (!origin && !cookieSession) return false; // Native bearer clients and provider callbacks.
  if (!trustedOrigin) return true;
  try {
    const expected = new URL(trustedOrigin);
    if (expected.origin !== trustedOrigin || expected.username || expected.password) return true;
    return origin !== expected.origin;
  } catch { return true; }
}

export const browserSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};
