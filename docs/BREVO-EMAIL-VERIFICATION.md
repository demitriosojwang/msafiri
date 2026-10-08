# Driver email sign-in

The Android email flow uses `POST /api/v1/driver/auth/email-challenges` with `{email}`. It verifies the returned challenge through the existing `POST /api/v1/driver/auth/sessions` endpoint. Phone SMS endpoints remain compatible with older clients; email requests never invoke Africa's Talking.

Configure `BREVO_API_KEY` as a Sensitive server variable in Vercel and `BREVO_SENDER_EMAIL` as an approved Brevo sender. The existing `DRIVER_AUTH_SECRET` is required. No provider key belongs in Android, Git, or chat. Brevo must have transactional sending enabled and sender verification completed. Domain authentication and delivery must be checked in the actual account.

The API sends a plain-text six-digit code through Brevo's HTTPS transactional API. Codes expire after five minutes, are stored as HMAC hashes, and are claimed atomically once. Requests are limited per email and globally, with a 60-second resend cooldown, five code attempts and invalidation after provider failure. Provider acceptance is not proof of inbox delivery; confirm a real email arrives and verify its code separately.

The additive `20261008_driver_email_auth` migration adds nullable unique driver emails and verification timestamps. Existing phone identities are preserved. Email authentication only matches the exact normalized email already linked to a driver: it never guesses identity from a supplied phone or automatically takes over a phone account. Approved staff must handle linking existing accounts. Email applicants have no fabricated phone or M-Pesa number; their contact phone is collected in the profile and payout ownership still requires finance review.

For a reviewed schema rollout only, the build flag `MIRELI_APPLY_DATABASE_MIGRATIONS=true` runs `prisma migrate deploy` using the existing direct connection. It does not reset or seed. Ordinary builds leave this flag absent/false. Existing bootstrap protection remains separate.

Validation on 8 October 2026: 62 backend tests, TypeScript and ESLint passed. The email migration SQL applied successfully in an isolated PostgreSQL database and the generated Prisma client queried it successfully. Local Windows Prisma migration engine returned an unspecified schema-engine error; the Vercel protected preview independently built and ran versioned migrations successfully. The local Next build compiled and typechecked but its final standalone-copy step hit Windows EPERM; the Vercel build completed. Android pilot unit tests (35), APK build and lint passed; both updated pilot/staging instrumentation APKs compile. The fresh pilot emulator test passed for the email field and persistent light/dark theme.

Brevo account access and real delivery remain pending. `emailSignInOpen` stays false without actual provider configuration. New-driver intake, document review, navigation and payouts retain their independent production gates; email delivery alone does not open those services or prove production readiness. No application data was seeded in the live database.

Production deployment `dpl_A55GLxxXprwHnW53xjnRNr9X2YpD` is Ready and serves the official `https://mireli-tau.vercel.app` alias. Live status, routes and trains return 200; unauthenticated account access returns 401. Email delivery remains disabled pending Brevo configuration.
