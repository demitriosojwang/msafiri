# Fresh startup and browser protections — 6 October 2026

Normal `npm run preview:local` now uses `.local/fresh-preview.db` and does not run
the seed script. Existing databases are preserved. Sample insertion requires the
explicit `--with-sample-data` argument. Never pass it against production.
Reading missing PlatformConfig now returns 503 instead of writing guessed defaults.

Driver registration remains fail-closed until real staff authentication exists,
as well as OTP, private document storage, malware scanning, a named compliance
review roster and policy configuration. The production administrator login still
returns 503, so adding environment values alone cannot turn intake on. Presence is
not provider or compliance proof.
Prisma binds query values; no raw SQL is assembled from driver input. JSON bodies
are bounded and validated. React and native Android render plain text.

The Next proxy adds per-response nonce CSP, denies inline script attributes,
framing and MIME sniffing, and checks browser mutation origins. Configure the exact
HTTPS `MIRELI_PUBLIC_ORIGIN` for the deployment. Native bearer requests do not need
an Origin header. Provider callbacks still require their route-specific validation.
HTML uses dynamic rendering so Next's own scripts receive the fresh nonce.

Verified: 37 unit/security tests, typecheck, lint and production build; local
production HTML has changing nonces matching script tags; cross-origin mutation
403; unconfigured registration closed. Admin login hydrates in a real browser with
no captured CSP/JS errors. No seeds, live migrations or provider transactions ran.

Vercel dashboard access now confirms the existing msafiri project and Prisma
Postgres environment variables. Driver provider configuration is absent. Do not
promote this change until actual schema/history, backup/restore and provider/staff
configuration are reconciled. Production passenger/admin login remains blocked
pending verified authentication. A successful preview build is not live readiness.
