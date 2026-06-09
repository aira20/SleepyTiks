-- Phase 1: Payment Settings, Middleman Fee Tiers, Payment Fee Rules

-- GuildPaymentSettings
CREATE TABLE "GuildPaymentSettings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL DEFAULT 'BCA',
    "accountNumber" TEXT NOT NULL DEFAULT '6760315042',
    "accountHolder" TEXT NOT NULL DEFAULT 'Azra Reza Satria H',
    "qrisImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildPaymentSettings_pkey" PRIMARY KEY ("id")
);

-- MiddlemanFeeTier
CREATE TABLE "MiddlemanFeeTier" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "minAmount" INTEGER NOT NULL,
    "maxAmount" INTEGER,
    "fee" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiddlemanFeeTier_pkey" PRIMARY KEY ("id")
);

-- PaymentFeeRule
CREATE TABLE "PaymentFeeRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentFeeRule_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "GuildPaymentSettings_guildId_key" ON "GuildPaymentSettings"("guildId");
CREATE UNIQUE INDEX "PaymentFeeRule_guildId_methodName_key" ON "PaymentFeeRule"("guildId", "methodName");

-- Indexes
CREATE INDEX "MiddlemanFeeTier_guildId_minAmount_idx" ON "MiddlemanFeeTier"("guildId", "minAmount");
CREATE INDEX "PaymentFeeRule_guildId_idx" ON "PaymentFeeRule"("guildId");

-- Foreign keys
ALTER TABLE "GuildPaymentSettings" ADD CONSTRAINT "GuildPaymentSettings_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MiddlemanFeeTier" ADD CONSTRAINT "MiddlemanFeeTier_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentFeeRule" ADD CONSTRAINT "PaymentFeeRule_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
