-- Extend PaymentFeeRule: add recommended, enabled, description columns
ALTER TABLE "PaymentFeeRule"
  ADD COLUMN "recommended"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "description"  TEXT;

-- Extend GuildPaymentSettings: add custom payment method settings
ALTER TABLE "GuildPaymentSettings"
  ADD COLUMN "allowCustomPaymentMethods" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "customMethodFee"           INTEGER  NOT NULL DEFAULT 2500,
  ADD COLUMN "customMethodLabel"         TEXT     NOT NULL DEFAULT 'Other Payment Method';
