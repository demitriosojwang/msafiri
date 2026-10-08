# Mireli backend restoration verification

Date: 8 October 2026. Production replacement explicitly approved by the user and deployed successfully.

## Root causes and changes

The official `mireli-tau.vercel.app` alias points to the existing Vercel `msafiri` project in `demitriosojwang-4569s-projects`. Its old production deployment serves the passenger home page but lacks `/api/v1/driver/status`, which returns 404. The implemented driver API was present only in the newer local/preview source.

The connected Prisma resource `prisma-postgres-coral-fountain` was Available, but a read-only inventory of every non-system schema found zero application tables. Environment values marked Sensitive are intentionally omitted from local CLI exports; this is not evidence that those live values were empty. Existing database credentials were used inside Vercel rather than replaced.

The existing driver migration failed on a clean isolated PostgreSQL database because the core `Booking` table did not exist. Added the missing schema-only `20261001_initial_postgres` baseline before `20261006_driver_services`. The new build wrapper keeps ordinary builds unchanged in behavior and runs migration bootstrap only when the per-deployment `MIRELI_INITIALIZE_EMPTY_DATABASE=true` setting is explicitly supplied. Bootstrap refuses existing application tables and unknown counts. No seed, reset or db-push command is used.

A protected preview build initialized the confirmed empty connected database through those versioned migrations. A subsequent read-only inventory found 25 tables: 24 application tables plus Prisma migration history. No driver, passenger, booking, train, fare, administrator or payout records were seeded.

The passenger route catalogue previously invoked the scheduling/payment engine on a GET request and failed with HTTP 500 when operating settings were absent. It now reads configured routes directly, returns the genuine empty catalogue on an empty platform and returns a controlled 503 on database failure without disclosing credentials. Trip and booking operations retain their existing engine and configuration gates.

Cryptographically random driver and session authentication secrets were configured as Sensitive variables for both Preview and Production. The exact production origin was configured. The temporary local secret copy was removed. SMS, private document storage, malware scanning, staff authentication and routing configuration have not been fabricated or enabled with demo values.

## Verification

- Reproduced the missing-baseline `P3018` / missing `Booking` failure only in a dedicated local PostgreSQL container on port 55871.
- Seven bootstrap guard tests failed before implementation, then passed. Three catalogue regression tests failed before the catalogue fix, then passed.
- All 52 unit/security tests passed; TypeScript and lint passed, including the new deployment scripts.
- Applying both migrations to a blank rehearsal database produced no schema differences against `prisma/schema.prisma`.
- A custom-format rehearsal backup restored successfully into another isolated database, with no schema differences and zero drivers/bookings. Re-running bootstrap against that initialized database was refused. The disposable task container was removed; unrelated containers were untouched.
- Latest protected preview: `dpl_FceRXRSBZ8FGw1H2DVwHYEbQD4vR`, https://msafiri-klc0o5hy6-demitriosojwang-4569s-projects.vercel.app . Vercel reports Ready.
- Preview `/api/v1/driver/status`: 200, `simulation:false`, `phoneSignInOpen:false`, `registrationOpen:false`, `navigationOpen:false`.
- Preview `/api/routes`: 200 with `{routes:[]}`. Preview `/api/trains`: 200 with `{trains:[]}`. Unauthenticated driver `/me`: 401 in the preceding verified preview. Home: 200 in the preceding verified preview.
- Approved production deployment: `dpl_6xkDjjooYk9kSJ4K2exenF9ff7Z1`. Vercel reports Ready and assigns the official `https://mireli-tau.vercel.app` alias. Live HTTP verification: home 200; driver status 200 (`simulation:false`, phone sign-in, registration and navigation closed); routes and trains 200 with empty catalogues; unauthenticated driver `/me` 401. No bootstrap flag was supplied for this production deployment.

## Steps required to finish

1. Production restoration is complete and the official alias is verified. Preserve the honest readiness gates while configuring the remaining real services.
2. Configure the company's actual Africa's Talking live account credentials (`AT_USERNAME`, `AT_API_KEY`, and its approved sender if required). Check provider credit and delivery. The user supplied an owned test number, but no real SMS has been sent.
3. Verify SMS delivery and a real authenticated driver session separately. New-driver registration remains deliberately closed until private document handling, malware scanning, named reviewer permissions, reviewed public policies and verified staff authentication are ready. The current database has no existing driver accounts; do not seed an approved driver or bypass this gate to claim sign-in success.
4. Remote main was fetched and confirmed to be an ancestor of the verified restoration (zero remote-only commits). Publish with a normal fast-forward push, then verify the official API again so future Git deployments retain the restored backend.

This record verifies a working production driver API and initialized schema. It does not certify a working live SMS sign-in, onboarding service, passenger booking operation, payout service or Play release.
