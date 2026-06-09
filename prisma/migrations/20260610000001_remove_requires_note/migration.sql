-- Remove requiresNote column from PaymentFeeRule
ALTER TABLE "PaymentFeeRule" DROP COLUMN IF EXISTS "requiresNote";
