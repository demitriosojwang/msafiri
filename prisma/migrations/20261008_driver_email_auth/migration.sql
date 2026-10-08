-- Additive email authentication; existing phone identities and records are preserved.
ALTER TABLE "Driver" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Driver" ADD COLUMN "email" TEXT, ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");
ALTER TABLE "DriverAuthChallenge" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "DriverAuthChallenge" ADD COLUMN "email" TEXT, ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'sms';
CREATE INDEX "DriverAuthChallenge_email_createdAt_idx" ON "DriverAuthChallenge"("email", "createdAt");
