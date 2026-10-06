# Mireli Web alignment — 4 October 2026

Company contact: **mirelisgr001@gmail.com**. Confirmed passenger URL:
https://mireli-tau.vercel.app/.

## Source of truth and preservation

This working copy adopts `demitriosojwang/msafiri` main commit
`687ef7a0b7e14fc97628f578dfafe15a500cd0cc`. The 139 extracted application/source
files were verified byte-for-byte against their Git object hashes before editing.
The checkout is sparse: historical uploads, database files and tool outputs are
not needed to develop the app. Do not interpret their absence as lost local work.

The original `C:\Users\user\Desktop\msafiri` is unchanged, including its staged
changes, uncommitted features, Android package, local database and environment.
Its HEAD was `9da37aa`. It is an older architecture with extensive local additions;
a blind pull/overwrite would not be a safe merge.

| Area | Original local work | Adopted cofounder model |
| --- | --- | --- |
| Identity | User / DriverProfile / NextAuth | Passenger / Driver / signed cookies |
| Transport | Vehicle holds departure and booked seats | Trip is separate from Driver |
| Network | Stage / TrainSchedule | Route / RouteStage / Train |
| Money | WalletEntry and local payment APIs | LedgerEntry / Credit / RefundRecord / PayoutRecord |
| Interface | Multi-role feeder components | Passenger website and separate admin interface |
| Database | SQLite file, confirmed in local environment | GitHub also declared SQLite; this copy is PostgreSQL-configured |

Local dispatch, safety, onboarding, documents, GPS, translations and Android/PWA
work remain in the original folder. They have **not** been blindly mixed into
the new data model. Port each with ownership checks and tests against this model.

## Changes in the aligned copy

- Retains cofounder passenger/admin UI and booking/charter/credit/ledger code.
- Adds the company contact to the passenger footer.
- PostgreSQL datasource and pinned Prisma 6.19.3; no live migration executed.
- Portable npm build/start commands and Windows-compatible dependencies.
- Type errors are build failures rather than suppressed warnings.
- Session signing requires a proper production secret; validates claims and
  token format; production cookies are secure and HTTP-only.
- Prototype four-digit sign-in is restricted to explicitly enabled local
  development. Vercel/production sign-in returns 503 until verified authentication
  is implemented. This intentional restriction is a deployment blocker.
- Missing M-Pesa credentials cannot silently become successful mock payments
  outside the explicit local preview.
- Query logging disabled to reduce passenger/payment data in server logs.
- Timer-driven departure/completion is limited to local simulation; live
  journeys require the forthcoming authenticated driver command API.
- Kenya calendar-day and train-time calculations use UTC+03:00 explicitly,
  avoiding different departure times on a UTC-hosted Vercel server.
- Legacy destructive seeding is disabled. Preview data lives only in this
  checkout's `.local/preview.db`; setup preserves existing preview progress.
- Imported `.env`, SQLite database and old Bun lock are removed from this branch's
  tracked snapshot. Removing a file does not remove it from upstream history.

## Local use

```sh
npm ci --ignore-scripts
npm run preview:local
```

Open http://127.0.0.1:3100. This starts a prominently labelled synthetic service.
The launcher forces the local database and mock payments, generates its own
session secret, and refuses Vercel or production environments. No existing `.env`
or database is copied. Sample train times, fares, vehicles and identities are
fixtures, not verified operational schedules.

Local-only admin demo: company contact email, any four digits, access code
`LOCAL-ONLY`. These credentials cannot pass the production authentication gate.
Use `npm run db:generate` before a PostgreSQL build after running the SQLite preview;
`npm run build` already does this.

## PostgreSQL / Vercel gate

The user confirms Prisma Postgres is used on Vercel. GitHub's production deployment
`6793838353` reports successful deployment of this same upstream commit on
1 October 2026. Its Vercel status links to deployment
`DE6aBVBi4jzrNCUt9bpJRepAdji6`. Both inspected schemas were SQLite; the actual
Vercel environment, database provider and migration history remain **unverified**.
Do not point this branch at production and run db push/reset/seed.

1. Reconcile the Vercel project's environment/database provider with that deployed commit without
   exposing connection strings. Keep them in Vercel secrets or an ignored local file.
2. Take and restore-test a production backup; use an isolated staging database.
3. Introspect staging to a separate schema file and compare tables, indexes,
   constraints and `_prisma_migrations` with the proposed schema.
4. If existing tables match, baseline their migration history correctly; otherwise
   write reviewed forward migrations/data transforms preserving IDs, bookings,
   money and timestamps. No existing SQLite migration can simply run on Postgres.
5. Test migrations against a restored staging copy, including concurrent seat
   reservations, credit redemption, payment callbacks, refunds and payout replay.
6. Complete verified OTP/admin authentication and the financial/driver gates below
   before changing the live Vercel branch or environment.

Prisma 6 TCP connection syntax and datasource configuration are documented in
[connection URLs](https://docs.prisma.io/docs/orm/v6/reference/connection-urls) and
[data sources](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources).
Use the provider-issued pooled/direct URLs according to its connection guidance;
do not paste database credentials into Android, browser code, docs or chat.

## Remaining inherited risks — not a production certification

- No authenticated driver session/API exists in upstream. Admin-managed driver
  records alone do not authenticate a driver.
- Prototype passenger/admin authentication needs real single-use, expiring,
  rate-limited challenges and admin MFA/revocation.
- Upstream timers departed/completed trips and triggered ledger changes. These
  are now limited to local simulation. Live driver commands still need explicit
  authorization, idempotency and transactional state changes.
- Seat allocation, credits, refunds and payouts need transactional concurrency
  and replay tests on PostgreSQL. A successful demo is not proof of those properties.
- Payment callbacks and settlement evidence need authenticity, amount/identity
  matching, idempotency and recovery review before live funds.
- Guest welcome-credit abuse, sensitive identity collection, retention/deletion,
  document access and operational permissions need review.
- Scheduling currently runs during API reads; production requires durable jobs,
  distributed concurrency control and monitoring.
- Fare, cancellation, tax, transport licensing and privacy wording require
  operator/legal validation. Existing UI statements are inherited product copy.

No deployment, production database change, real payment or message to the
cofounder has been performed by this alignment work.
