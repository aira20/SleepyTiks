import { prisma } from './prisma';
import { FEE_BRACKETS } from './middlemanFee';

// ── Default payment methods buat server baru
// Edit list ini kalo mau ngubah default-nya server baru.
// Server yang udah ada ga akan kesentuh sama sekali.
const DEFAULT_PAYMENT_METHODS: {
  methodName:  string;
  fee:         number;
  recommended: boolean;
  description: string | null;
}[] = [
  { methodName: 'BCA',     fee: 0,    recommended: true,  description: null },
  { methodName: 'SeaBank', fee: 0,    recommended: true,  description: null },
  { methodName: 'DANA',    fee: 0,    recommended: false, description: null },
  { methodName: 'GoPay',   fee: 1000, recommended: false, description: null },
];

/**
 * Ensures all configurable settings exist for a guild.
 * Safe to call on every ticket creation — uses upsert, never overwrites existing config.
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
    where:  { guildId },
    update: {},
    create: {
      guildId,
      bankName:      'BCA',
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
      fee:       b.fee,
      sortOrder: i,
    })),
  });
}

async function seedPaymentFeeRules(guildId: string): Promise<void> {
  const existing = await prisma.paymentFeeRule.count({ where: { guildId } });
  if (existing > 0) return;

  await prisma.paymentFeeRule.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((m, i) => ({
      guildId,
      methodName:  m.methodName,
      fee:         m.fee,
      recommended: m.recommended,
      enabled:     true,
      description: m.description,
      sortOrder:   i,
    })),
  });
}
