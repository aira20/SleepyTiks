import { prisma } from './prisma';
import { FEE_BRACKETS } from './middlemanFee';
import { PAYMENT_METHODS } from './paymentFee';

/**
 * Ensures all Phase 1 configurable settings exist for a guild.
 * Safe to call on every ticket creation — uses upsert, never overwrites existing config.
 * Seeds defaults that exactly mirror the previous hardcoded behavior.
 */
export async function ensureGuildDefaults(guildId: string): Promise<void> {
  await Promise.all([
    seedPaymentSettings(guildId),
    seedFeeTiers(guildId),
    seedPaymentFeeRules(guildId),
  ]);
}

async function seedPaymentSettings(guildId: string): Promise<void> {
  await prisma.guildPaymentSettings.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      bankName: 'BCA',
      accountNumber: '6760315042',
      accountHolder: 'Azra Reza Satria H',
    },
  });
}

async function seedFeeTiers(guildId: string): Promise<void> {
  const existing = await prisma.middlemanFeeTier.count({ where: { guildId } });
  if (existing > 0) return;

  await prisma.middlemanFeeTier.createMany({
    data: FEE_BRACKETS.map((b, i) => ({
      guildId,
      minAmount: b.min,
      maxAmount: b.max === Infinity ? null : b.max,
      fee: b.fee,
      sortOrder: i,
    })),
  });
}

async function seedPaymentFeeRules(guildId: string): Promise<void> {
  const existing = await prisma.paymentFeeRule.count({ where: { guildId } });
  if (existing > 0) return;

  await prisma.paymentFeeRule.createMany({
    data: PAYMENT_METHODS.map((m, i) => ({
      guildId,
      methodName: m.label,
      fee: m.fee,
      sortOrder: i,
    })),
  });
}
