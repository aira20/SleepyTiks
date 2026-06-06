// ─── Payment Method Fee Service ──────────────────────────────────────────────
//
// Single source of truth for the *additional* payment-method fee that is
// charged on top of the existing middleman fee. The middleman fee math lives
// in ./middlemanFee.ts and is NOT touched by this module.
//
// New e-wallets / banks → add an entry to PAYMENT_METHODS below.
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentMethodCode =
  | 'BCA'
  | 'OVO'
  | 'SHOPEEPAY'
  | 'GOPAY'
  | 'LINKAJA'
  | 'OTHER_BANK';

export interface PaymentMethod {
  code: PaymentMethodCode;
  /** Short label used in dropdown options & embed display. */
  label: string;
  /** Longer description shown under the dropdown option. */
  description: string;
  /** Emoji used in the dropdown for quick visual recognition. */
  emoji: string;
  /** Additional fee in IDR added on top of the middleman fee. */
  fee: number;
  /** Whether picking this method needs a follow-up "bank name" prompt. */
  requiresBankName: boolean;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { code: 'BCA',        label: 'BCA',        description: 'Bank Central Asia — no extra fee',          emoji: '🏦', fee: 0,     requiresBankName: false },
  { code: 'OVO',        label: 'OVO',        description: 'OVO e-wallet — no extra fee',               emoji: '💜', fee: 0,     requiresBankName: false },
  { code: 'SHOPEEPAY',  label: 'ShopeePay',  description: 'ShopeePay e-wallet — no extra fee',         emoji: '🛒', fee: 0,     requiresBankName: false },
  { code: 'GOPAY',      label: 'GoPay',      description: 'GoPay e-wallet — Rp1.000 transfer fee',     emoji: '🟢', fee: 1_000, requiresBankName: false },
  { code: 'LINKAJA',    label: 'LinkAja',    description: 'LinkAja e-wallet — Rp1.000 transfer fee',   emoji: '🔴', fee: 1_000, requiresBankName: false },
  { code: 'OTHER_BANK', label: 'Other Bank', description: 'Mandiri, BRI, BNI, CIMB, etc. — Rp2.500',   emoji: '🏛️', fee: 2_500, requiresBankName: true  },
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
