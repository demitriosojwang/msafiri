-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "boardedSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noShowReason" TEXT,
ADD COLUMN     "noShowSeats" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayoutRecord" ADD COLUMN     "ledgerEntryId" TEXT,
ADD COLUMN     "settlementVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DriverSession" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverTripProgress" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'assigned',
    "version" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverTripProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverTripAction" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "clientActionId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverTripAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverSupportCase" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "clientActionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reply" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayoutDestination" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "version" INTEGER NOT NULL DEFAULT 0,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPayoutDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAuthChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DriverApplication" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 0,
    "licenceClass" TEXT NOT NULL DEFAULT '',
    "ownsVehicle" BOOLEAN NOT NULL DEFAULT true,
    "policyVersion" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'pending_review',
    "scanState" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAttempt" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "callbackHash" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'submitting',
    "conversationId" TEXT,
    "originatorId" TEXT,
    "receipt" TEXT,
    "resultCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverSession_tokenHash_key" ON "DriverSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DriverSession_driverId_expiresAt_idx" ON "DriverSession"("driverId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverTripProgress_tripId_driverId_key" ON "DriverTripProgress"("tripId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverTripAction_driverId_clientActionId_key" ON "DriverTripAction"("driverId", "clientActionId");

-- CreateIndex
CREATE INDEX "DriverSupportCase_driverId_createdAt_idx" ON "DriverSupportCase"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSupportCase_driverId_clientActionId_key" ON "DriverSupportCase"("driverId", "clientActionId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayoutDestination_driverId_key" ON "DriverPayoutDestination"("driverId");

-- CreateIndex
CREATE INDEX "DriverAuthChallenge_phone_createdAt_idx" ON "DriverAuthChallenge"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverApplication_driverId_key" ON "DriverApplication"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocument_objectKey_key" ON "DriverDocument"("objectKey");

-- CreateIndex
CREATE INDEX "DriverDocument_applicationId_type_state_idx" ON "DriverDocument"("applicationId", "type", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_callbackHash_key" ON "PayoutAttempt"("callbackHash");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_conversationId_key" ON "PayoutAttempt"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_receipt_key" ON "PayoutAttempt"("receipt");

-- CreateIndex
CREATE INDEX "PayoutAttempt_payoutId_state_idx" ON "PayoutAttempt"("payoutId", "state");

-- CreateIndex
CREATE INDEX "Trip_driverId_status_departureAt_idx" ON "Trip"("driverId", "status", "departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecord_ledgerEntryId_key" ON "PayoutRecord"("ledgerEntryId");

-- AddForeignKey
ALTER TABLE "DriverSession" ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTripProgress" ADD CONSTRAINT "DriverTripProgress_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTripProgress" ADD CONSTRAINT "DriverTripProgress_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTripAction" ADD CONSTRAINT "DriverTripAction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverSupportCase" ADD CONSTRAINT "DriverSupportCase_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayoutDestination" ADD CONSTRAINT "DriverPayoutDestination_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverApplication" ADD CONSTRAINT "DriverApplication_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DriverApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAttempt" ADD CONSTRAINT "PayoutAttempt_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PayoutRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
