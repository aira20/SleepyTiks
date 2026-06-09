// ─── Payment Method Fee Service ──────────────────────────────────────────────
//
// Single source of truth for the *additional* payment-method fee that is
// charged on top of the existing middleman fee. The middleman fee math lives
// in ./middlemanFee.ts and is NOT touched by this module.
//
// New e-wallets / banks → add an entry to PAYMENT_METHODS below.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbPaymentFeeRule {
  methodName: string;
  fee: number;
}

/**
 * Looks up the additional payment fee for a method name from DB rules.
 * Case-insensitive match. Returns 0 if not found.
 */
export function getPaymentMethodFeeFromRules(
  methodName: string | null | undefined,
  rules: DbPaymentFeeRule[],
): number {
  if (!methodName) return 0;
  const lower = methodName.trim().toLowerCase();
  return rules.find(r => r.methodName.toLowerCase() === lower)?.fee ?? 0;
}

/**
 * Formats a payment method label from DB rules.
 */
export function formatPaymentMethodLabelFromRules(
  methodName: string | null | undefined,
  rules: DbPaymentFeeRule[],
): string {
  if (!methodName) return 'Not specified';
  const lower = methodName.trim().toLowerCase();
  const rule = rules.find(r => r.methodName.toLowerCase() === lower);
  return rule ? rule.methodName : methodName;
}

export type PaymentMethodCode =
  | 'BCA'
  | 'OVO'
  | 'SHOPEEPAY'
  | 'DANA'
  | 'GOPAY'
  | 'LINKAJA'
  | 'OTHER_BANK';

export interface PaymentMethod {
  code: PaymentMethodCode;
  label: string;
  description: string;
  emoji: string;
  fee: number;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { code: 'BCA',        label: 'BCA',        description: 'Bank Central Asia — no extra fee',          emoji: '🏦', fee: 0     },
  { code: 'OVO',        label: 'OVO',        description: 'OVO e-wallet — no extra fee',               emoji: '💜', fee: 0     },
  { code: 'SHOPEEPAY',  label: 'ShopeePay',  description: 'ShopeePay e-wallet — no extra fee',         emoji: '🛒', fee: 0     },
  { code: 'DANA',       label: 'DANA',       description: 'DANA e-wallet — no extra fee',              emoji: '🔵', fee: 0     },
  { code: 'GOPAY',      label: 'GoPay',      description: 'GoPay e-wallet — Rp1.000 transfer fee',     emoji: '🟢', fee: 1_000 },
  { code: 'LINKAJA',    label: 'LinkAja',    description: 'LinkAja e-wallet — Rp1.000 transfer fee',   emoji: '🔴', fee: 1_000 },
  { code: 'OTHER_BANK', label: 'Other Bank', description: 'Mandiri, BRI, BNI, CIMB, etc. — Rp2.500',  emoji: '🏛️', fee: 2_500 },
] as const;

const PAYMENT_METHOD_BY_CODE: Record<string, PaymentMethod> = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.code, m]),
);

/**
 * Resolves a payment method by its code. Returns null if the code is not a
 * recognized PaymentMethodCode — callers should treat that as "no payment fee
 * configured" so old tickets (created before this feature shipped) keep working.
 */
export function getPaymentMethod(code: string | null | undefined): PaymentMethod | null {
  if (!code) return null;
  return PAYMENT_METHOD_BY_CODE[code] ?? null;
}

/**
 * Server-side fee resolver. Always re-derives the fee from the canonical
 * PAYMENT_METHODS table — never trust a fee value that came from the client.
 */
export function getPaymentMethodFee(code: string | null | undefined): number {
  return getPaymentMethod(code)?.fee ?? 0;
}

/**
 * Renders the full payment-method label, including a bank name when the user
 * picked "Other Bank". The bank name is only shown for OTHER_BANK and is
 * truncated to a sane length so it can never blow up an embed field.
 */
export function formatPaymentMethodLabel(
  code: string | null | undefined,
  bankName?: string | null,
): string {
  const method = getPaymentMethod(code);
  if (!method) return 'Not specified';

  if (method.code === 'OTHER_BANK') {
    const cleaned = (bankName ?? '').trim().slice(0, 50);
    return cleaned ? `${method.label} — ${cleaned}` : method.label;
  }

  return method.label;
}
