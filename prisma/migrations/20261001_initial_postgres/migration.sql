-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "nationality" TEXT,
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mpesaNumber" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "cabType" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Train" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "originCode" TEXT NOT NULL,
    "destCode" TEXT NOT NULL,
    "originTime" TEXT NOT NULL,
    "destTime" TEXT NOT NULL,
    "destDayOffset" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Train_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "charterPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStage" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fare" INTEGER NOT NULL,
    "homeSurcharge" INTEGER NOT NULL,

    CONSTRAINT "RouteStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT,
    "direction" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedSeats" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "departedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'schedule',
    "trainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "tripId" TEXT,
    "routeId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "stageId" TEXT,
    "stageName" TEXT,
    "homePickup" BOOLEAN NOT NULL DEFAULT false,
    "homeAddress" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "isCharter" BOOLEAN NOT NULL DEFAULT false,
    "fareAmount" INTEGER NOT NULL,
    "homeSurcharge" INTEGER NOT NULL,
    "creditApplied" INTEGER NOT NULL,
    "cashDue" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "cancelTier" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "allocationNote" TEXT,
    "passengerName" TEXT,
    "passengerPhone" TEXT,
    "passengerEmail" TEXT,
    "passengerIdType" TEXT,
    "passengerIdNumber" TEXT,
    "passengerNationality" TEXT,
    "passengerGender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tripId" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "cashAmount" INTEGER NOT NULL,
    "creditApplied" INTEGER NOT NULL,
    "homeSurchargeAmount" INTEGER NOT NULL,
    "mpesaReceipt" TEXT,
    "collectedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'held',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "creditRestored" INTEGER NOT NULL DEFAULT 0,
    "commissionReversed" INTEGER NOT NULL DEFAULT 0,
    "driverClawback" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "mpesaResultCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stuckFlaggedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRecord" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripId" TEXT,
    "grossFareTotal" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "homeSurchargeAmount" INTEGER NOT NULL,
    "netPayoutAmount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'b2c',
    "mpesaResultCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "failureReason" TEXT,
    "batchId" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "sourceBookingId" TEXT,
    "amount" INTEGER NOT NULL,
    "initialAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedBookingId" TEXT,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpesaTransaction" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "checkoutRequestId" TEXT NOT NULL,
    "merchantRequestId" TEXT NOT NULL,
    "mpesaReceipt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'stk_push_sent',
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "MpesaTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "fullRefundCutoffMinutes" INTEGER NOT NULL DEFAULT 60,
    "seatFillThresholdPercent" INTEGER NOT NULL DEFAULT 70,
    "creditValidityDays" INTEGER NOT NULL DEFAULT 30,
    "payoutMode" TEXT NOT NULL DEFAULT 'weekly',
    "payoutDay" INTEGER NOT NULL DEFAULT 5,
    "stuckRefundHours" INTEGER NOT NULL DEFAULT 4,
    "stuckPayoutHours" INTEGER NOT NULL DEFAULT 24,
    "sweepPendingMinutes" INTEGER NOT NULL DEFAULT 5,
    "tripHorizonDays" INTEGER NOT NULL DEFAULT 2,
    "bookingWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "terminusArrivalBufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "trainMeetBufferMinutes" INTEGER NOT NULL DEFAULT 45,
    "mpesaEnvironment" TEXT NOT NULL DEFAULT 'sandbox',
    "mpesaConsumerKey" TEXT NOT NULL DEFAULT '',
    "mpesaConsumerSecret" TEXT NOT NULL DEFAULT '',
    "mpesaShortcode" TEXT NOT NULL DEFAULT '',
    "mpesaPasskey" TEXT NOT NULL DEFAULT '',
    "mpesaCallbackBaseUrl" TEXT NOT NULL DEFAULT '',
    "mpesaB2CShortcode" TEXT NOT NULL DEFAULT '',
    "mpesaInitiatorName" TEXT NOT NULL DEFAULT '',
    "mpesaInitiatorPassword" TEXT NOT NULL DEFAULT '',
    "mpesaSecurityCredential" TEXT NOT NULL DEFAULT '',
    "mpesaCert" TEXT NOT NULL DEFAULT '',
    "mpesaLastTestAt" TIMESTAMP(3),
    "mpesaLastTestOk" BOOLEAN,
    "mpesaLastTestMessage" TEXT NOT NULL DEFAULT '',
    "adminEmails" TEXT NOT NULL DEFAULT '["demitri@mireli.co.ke","admin@mireli.co.ke"]',
    "admin2faCode" TEXT NOT NULL DEFAULT 'mireli2026',
    "lastPayoutRunAt" TIMESTAMP(3),
    "lastReconciliationAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_phone_key" ON "Passenger"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_bookingId_key" ON "LedgerEntry"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_checkoutRequestId_key" ON "MpesaTransaction"("checkoutRequestId");

-- AddForeignKey
ALTER TABLE "RouteStage" ADD CONSTRAINT "RouteStage_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "Train"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MpesaTransaction" ADD CONSTRAINT "MpesaTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
